import { db } from '@mindstudio-ai/agent';
import { Repositories } from './tables/repositories';
import { Files } from './tables/files';
import {
  parseGitHubUrl,
  fetchRepoInfo,
  fetchRepoTree,
  fetchRawContent,
  type ParsedRepo,
  type TreeNode,
} from './common/githubClient';
import { shouldIngest, detectLanguage } from './common/fileFilters';
import { chunkAndEmbedFile } from './common/chunkAndEmbedFile';

interface IngestRepositoryInput {
  /** A GitHub repository URL (https or git@). */
  githubUrl: string;
}

interface IngestRepositoryOutput {
  repositoryId: string;
  repoName: string;
  defaultBranch: string;
  /**
   * Always `'processing'` on a successful return — the heavy work runs
   * in the background. Poll the `repositories` row for transitions to
   * `'completed'` or `'failed'`.
   */
  status: 'processing';
}

/** Mutations-per-batch ceiling for file upserts. */
const FILE_BATCH_SIZE = 100;

/**
 * Step 3 of the Codebase Bible pipeline: kick off ingestion of a GitHub
 * repository.
 *
 * Two-phase shape:
 *
 *   Phase A (synchronous, returned to caller):
 *     1. Parse and canonicalize the URL.
 *     2. Fetch repository metadata so we can validate the repo exists and
 *        learn the default branch. URL / not-found errors surface to the
 *        caller immediately.
 *     3. Upsert the `repositories` row with `status: 'processing'`.
 *     4. Return `{ repositoryId, repoName, defaultBranch, status }`.
 *
 *   Phase B (background, fire-and-forget):
 *     5. Fetch the recursive file tree.
 *     6. Filter to text-only blobs worth indexing.
 *     7. Upsert all surviving file rows (idempotent on (repoId, filePath)).
 *     8. For each file, fetch raw content and run `chunkAndEmbedFile`.
 *     9. Mark the repo `'completed'` with a fresh `lastScannedAt`.
 *
 *   On any background failure, mark the repo `'failed'` and stop. The
 *   error detail is in the method logs (`console.error`).
 */
export async function ingestRepository(
  input: IngestRepositoryInput,
): Promise<IngestRepositoryOutput> {
  // ── Phase A: synchronous validation + row creation ─────────────────
  const parsed = parseGitHubUrl(input.githubUrl);
  const repoInfo = await fetchRepoInfo(parsed);
  const defaultBranch = repoInfo.default_branch;

  const repo = await Repositories.upsert('githubUrl', {
    githubUrl: parsed.canonicalUrl,
    repoName: `${parsed.owner}/${parsed.name}`,
    status: 'processing',
    // `lastScannedAt` is intentionally NOT bumped here. It tracks the
    // last successful completion, not the start of a run. If a previous
    // ingestion succeeded its timestamp is preserved while this run is
    // in flight; if the new run fails we keep the older "last good" value.
  });

  // ── Phase B: fire-and-forget background ingestion ─────────────────
  //
  // Do not `await`. The platform keeps the execution context alive so
  // the un-awaited promise continues running after this method returns.
  // Failures inside `runIngestion` are caught and persisted as
  // `status: 'failed'`; failures of the status-write itself are logged
  // but cannot do more than that.
  void runIngestion(parsed, repo.id, defaultBranch).catch(async (err) => {
    console.error(
      `[ingestRepository] background run failed for repoId=${repo.id} (${parsed.canonicalUrl}):`,
      err,
    );
    try {
      await Repositories.update(repo.id, { status: 'failed' });
    } catch (statusErr) {
      console.error(
        `[ingestRepository] could not write 'failed' status for repoId=${repo.id}:`,
        statusErr,
      );
    }
  });

  return {
    repositoryId: repo.id,
    repoName: repo.repoName,
    defaultBranch,
    status: 'processing',
  };
}

/**
 * Background ingestion driver. Runs after `ingestRepository` has already
 * returned to the caller. All errors propagate so the outer `.catch`
 * can mark the repo failed.
 */
async function runIngestion(
  parsed: ParsedRepo,
  repoId: string,
  defaultBranch: string,
): Promise<void> {
  // Step 5: fetch the file tree.
  const tree = await fetchRepoTree(parsed, defaultBranch);

  // Step 6: filter to text-only blobs.
  const allBlobs = tree.tree.filter((n): n is TreeNode => n.type === 'blob');
  const validBlobs: TreeNode[] = [];
  let filteredCount = 0;
  for (const node of allBlobs) {
    const decision = shouldIngest(node.path, node.size);
    if (decision.keep) validBlobs.push(node);
    else filteredCount++;
  }

  // Step 7: upsert files in batches.
  const filesToProcess: Array<{ fileId: string; path: string }> = [];
  for (let i = 0; i < validBlobs.length; i += FILE_BATCH_SIZE) {
    const slice = validBlobs.slice(i, i + FILE_BATCH_SIZE);
    const mutations = slice.map((node) =>
      Files.upsert(['repoId', 'filePath'], {
        repoId,
        filePath: node.path,
        language: detectLanguage(node.path),
      }),
    );
    const inserted = (await db.batch(...mutations)) as Array<{ id: string }>;
    inserted.forEach((row, j) => {
      filesToProcess.push({ fileId: row.id, path: slice[j].path });
    });
  }

  // Step 8: per-file fetch + chunk + embed. Serial today; we can switch
  // to a small concurrency pool later if throughput becomes the
  // bottleneck. Per-file failures are logged and skipped — they should
  // not abort the whole run, since a single bad file (network blip,
  // unicode trouble, transient 5xx) is recoverable on the next scan.
  let processed = 0;
  let processFailures = 0;
  let totalChunks = 0;
  for (const { fileId, path } of filesToProcess) {
    try {
      const rawContent = await fetchRawContent(parsed, defaultBranch, path);
      const result = await chunkAndEmbedFile(fileId, rawContent);
      totalChunks += result.chunkCount;
      processed++;
    } catch (err) {
      processFailures++;
      console.error(
        `[runIngestion] file '${path}' (id=${fileId}) failed to process:`,
        err,
      );
    }
  }

  // Step 9: mark complete. We set lastScannedAt only on a clean run end.
  await Repositories.update(repoId, {
    status: 'completed',
    lastScannedAt: Date.now(),
  });

  console.log(
    `[runIngestion] ${parsed.canonicalUrl}: ${processed} files processed (${processFailures} failed), ${totalChunks} chunks embedded, ${filteredCount} blobs filtered, branch=${defaultBranch}, truncated=${tree.truncated}`,
  );
}
