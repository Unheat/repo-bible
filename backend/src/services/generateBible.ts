import { prisma } from '../db/prisma.js';
import {
  generateArchitectureSummary,
  generateFileDeepDive,
} from '../lib/llmPrompts';

interface GenerateBibleInput {
  /** ID of an already-ingested repository. Must be `status === 'completed'`. */
  repositoryId: string;
}

interface GenerateBibleOutput {
  repositoryId: string;
  repoName: string;
  /** Always `'generating'` on success — the heavy work runs in the background. */
  docsStatus: 'generating';
}

/**
 * Concurrency for the per-file Deep-Dive loop. 200 sequential LLM calls
 * (a typical mid-size repo) would take 30-100 minutes wall-clock; 200
 * Promise.all-style parallel calls would hammer rate limits. A bounded
 * pool of 8 cuts the wall-clock to ~5-10 minutes while staying inside
 * comfortable rate-limit headroom.
 */
const DEEPDIVE_CONCURRENCY = 8;

/**
 * Cap on the source text we send to the Deep-Dive model. Keeps the
 * prompt comfortably inside Claude 4.6 Sonnet's 200K-token context
 * (~800K chars at 4 chars/token) with plenty of room for the architecture
 * context, preamble, and reasoning + response budget.
 *
 * For files that exceed this cap (which the ingestion filter already
 * limits to 1 MB), we truncate and append a marker the preamble teaches
 * the model to honor.
 */
const DEEPDIVE_MAX_INPUT_CHARS = 500_000;

/** Batch size for the final `generated_docs` write. */
const DEEPDIVE_INSERT_BATCH = 50;

/**
 * Step 4 of the Codebase Bible pipeline: generate the AI documentation.
 *
 * Two phases, fire-and-forget like ingestion:
 *
 *   Phase A (synchronous, returned to caller):
 *     1. Validate the repository exists and is fully ingested.
 *     2. Flip `docsStatus` to `'generating'`.
 *     3. Return immediately.
 *
 *   Phase B (background, fire-and-forget):
 *     4. Mapper: generate the repo-level architecture summary + Mermaid.
 *        Persist as a single `generated_docs` row with
 *        `docType: 'repo_overview'`.
 *     5. Deep-Dive: for each file, fetch chunks, run the per-file LLM
 *        prompt with concurrency 8, batch-insert results in groups of 50.
 *     6. Flip `docsStatus` to `'completed'`. On unhandled error, flip to
 *        `'failed'` and log the detail.
 *
 *   Generation history is preserved across re-runs: rows are pushed, not
 *   upserted. "Latest doc for a repo/file" is a `sortBy(created_at).reverse()`
 *   query at read time.
 */
export async function generateBible(
  input: GenerateBibleInput,
): Promise<GenerateBibleOutput> {
  // ── Phase A: synchronous validation + status flip ─────────────────
  const repo = await prisma.repository.findUnique({
    where: { id: input.repositoryId },
  });

  if (!repo) {
    throw new Error('Repository not found.');
  }
  if (repo.status !== 'completed') {
    throw new Error(
      `Repository ingestion is "${repo.status}". Wait for ingestion to complete before generating documentation.`,
    );
  }

  await prisma.repository.update({
    where: { id: repo.id },
    data: { docsStatus: 'generating' },
  });

  // ── Phase B: fire-and-forget background generation ────────────────
  void runGenerateBible(repo.id, repo.repoName).catch(async (err) => {
    console.error(
      `[generateBible] background run failed for repoId=${repo.id} (${repo.repoName}):`,
      err,
    );
    try {
      await prisma.repository.update({
        where: { id: repo.id },
        data: { docsStatus: 'failed' },
      });
    } catch (statusErr) {
      console.error(
        `[generateBible] could not write 'failed' docsStatus for repoId=${repo.id}:`,
        statusErr,
      );
    }
  });

  return {
    repositoryId: repo.id,
    repoName: repo.repoName,
    docsStatus: 'generating',
  };
}

/**
 * Background driver. All errors propagate so the outer `.catch` can
 * mark the repo failed.
 */
async function runGenerateBible(repoId: string, repoName: string): Promise<void> {
  // Fetch all files for this repo using Prisma
  const files = await prisma.file.findMany({
    where: { repoId },
    select: {
      id: true,
      filePath: true,
      language: true,
    },
  });

  if (files.length === 0) {
    console.warn(
      `[generateBible] repoId=${repoId} has zero files; nothing to document.`,
    );
    await prisma.repository.update({
      where: { id: repoId },
      data: { docsStatus: 'completed' },
    });
    return;
  }

  // ── Mapper phase ────────────────────────────────────────────────
  const fileTree = buildFileTreeText(files);
  console.log(
    `[generateBible] ${repoName}: running Mapper over ${files.length} files (tree=${fileTree.length} chars)…`,
  );
  const overviewMd = await generateArchitectureSummary(repoName, fileTree);

  await prisma.generatedDoc.create({
    data: {
      repoId,
      docType: 'repo_overview',
      markdownContent: overviewMd,
    },
  });

  // ── Deep-Dive phase ─────────────────────────────────────────────
  console.log(
    `[generateBible] ${repoName}: running Deep-Dive on ${files.length} files (concurrency=${DEEPDIVE_CONCURRENCY})…`,
  );

  const deepDiveResults = await runDeepDivePool(
    files,
    overviewMd,
    DEEPDIVE_CONCURRENCY,
  );

  // ── Persistence ─────────────────────────────────────────────────
  // Batch-insert all writeups in groups using Prisma transactions
  for (let i = 0; i < deepDiveResults.length; i += DEEPDIVE_INSERT_BATCH) {
    const slice = deepDiveResults.slice(i, i + DEEPDIVE_INSERT_BATCH);
    
    // Use createMany for batch insert
    await prisma.generatedDoc.createMany({
      data: slice.map((r) => ({
        repoId,
        fileId: r.fileId,
        docType: 'file_deepdive',
        markdownContent: r.markdown,
      })),
    });
  }

  await prisma.repository.update({
    where: { id: repoId },
    data: { docsStatus: 'completed' },
  });

  console.log(
    `[generateBible] ${repoName}: complete. ${deepDiveResults.length} file writeups + 1 architecture overview persisted.`,
  );
}

/** Render a list of `Files` rows as a sorted plain-text tree for the Mapper. */
function buildFileTreeText(files: Array<{ filePath: string; language: string }>): string {
  const sorted = [...files].sort((a, b) => a.filePath.localeCompare(b.filePath));
  return sorted.map((f) => `${f.filePath} (${f.language})`).join('\n');
}

/**
 * Concurrency-controlled Deep-Dive runner. Fans out up to `concurrency`
 * file analyses at once. Per-file failures are logged and skipped — a
 * single bad file (model hiccup, transient error) does not abort the
 * whole run.
 */
async function runDeepDivePool(
  files: Array<{ id: string; filePath: string; language: string }>,
  architectureContext: string,
  concurrency: number,
): Promise<Array<{ fileId: string; markdown: string }>> {
  const results: Array<{ fileId: string; markdown: string }> = [];
  const queue = [...files];
  let inFlight = 0;
  let completed = 0;
  let failures = 0;

  await new Promise<void>((resolve) => {
    const dispatch = () => {
      while (inFlight < concurrency && queue.length > 0) {
        const file = queue.shift()!;
        inFlight++;

        analyzeOneFile(file, architectureContext)
          .then((result) => {
            if (result) results.push(result);
          })
          .catch((err) => {
            failures++;
            console.error(
              `[generateBible] file '${file.filePath}' (id=${file.id}) failed:`,
              err,
            );
          })
          .finally(() => {
            inFlight--;
            completed++;
            if (completed % 10 === 0 || completed === files.length) {
              console.log(
                `[generateBible] Deep-Dive progress: ${completed}/${files.length} (${failures} failed so far)`,
              );
            }
            if (queue.length === 0 && inFlight === 0) {
              resolve();
            } else {
              dispatch();
            }
          });
      }
    };
    dispatch();
  });

  if (failures > 0) {
    console.warn(
      `[generateBible] Deep-Dive completed with ${failures}/${files.length} failures; partial results returned.`,
    );
  }
  return results;
}

/**
 * Pull a file's chunks, concatenate, run the Deep-Dive prompt. Returns
 * `null` if the file has zero chunks (empty / unreadable file).
 */
async function analyzeOneFile(
  file: { id: string; filePath: string; language: string },
  architectureContext: string,
): Promise<{ fileId: string; markdown: string } | null> {
  // Fetch this file's chunks using Prisma
  const chunks = await prisma.codeChunk.findMany({
    where: { fileId: file.id },
    select: {
      chunkText: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  if (chunks.length === 0) return null;

  // Concatenate chunks. Note: chunks already include a 400-char overlap
  // by design (see `textChunker`), so the seam between adjacent chunks
  // duplicates a small amount of source text. That redundancy is
  // harmless for the LLM and helps it recognize cross-chunk continuity.
  const concatenated = chunks.map((c) => c.chunkText).join('\n\n');
  const sourceCode =
    concatenated.length > DEEPDIVE_MAX_INPUT_CHARS
      ? concatenated.slice(0, DEEPDIVE_MAX_INPUT_CHARS) +
        '\n\n[... truncated ...]'
      : concatenated;

  const markdown = await generateFileDeepDive(
    file.filePath,
    file.language,
    sourceCode,
    architectureContext,
  );

  return { fileId: file.id, markdown };
}
