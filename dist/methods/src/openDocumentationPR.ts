import { Repositories } from './tables/repositories';
import { Files } from './tables/files';
import { GeneratedDocs } from './tables/generatedDocs';
import {
  parseGitHubUrl,
  fetchRepoInfo,
  fetchBranchHead,
  fetchCommitTreeSha,
  createBlob,
  createTree,
  createCommit,
  createBranch,
  openPullRequest,
} from './common/githubClient';

interface OpenDocumentationPRInput {
  /** Repository to publish docs for. Must have `docsStatus === 'completed'`. */
  repositoryId: string;
}

interface OpenDocumentationPROutput {
  prUrl: string;
  prNumber: number;
  branch: string;
  /** Number of markdown files committed (architecture overview + per-file writeups). */
  fileCount: number;
}

/**
 * Concurrency for blob creation. Each file becomes one POST to
 * /git/blobs; without a pool, a 200-file repo would serialize 200
 * round trips. 8 keeps things zippy without hammering rate limits —
 * same logic as the Deep-Dive pool.
 */
const BLOB_CONCURRENCY = 8;

/**
 * Step 5 of the Codebase Bible pipeline: publish the generated docs as
 * a Pull Request on the source repository.
 *
 * Pipeline:
 *   1. Validate repo + docsStatus.
 *   2. Collect the LATEST `repo_overview` row and the LATEST `file_deepdive`
 *      row per file (so re-runs don't pollute the PR with prior outputs).
 *   3. Materialize as a flat path → markdown map:
 *        `docs/ARCHITECTURE.md`            → repo_overview
 *        `docs/<original-path>.bible.md`   → file_deepdive
 *      The `.bible.md` suffix prevents collisions with any existing
 *      docs/* files in the repo and signals "AI-generated".
 *   4. GitHub Git Data API dance:
 *        a. Resolve default branch HEAD commit SHA.
 *        b. Resolve that commit's tree SHA.
 *        c. Create one blob per markdown file (concurrency-bounded).
 *        d. Create a new tree based on (b) with all blobs added.
 *        e. Create a commit pointing at the new tree, parented to (a).
 *        f. Create a branch ref `codebase-bible-<unix-ms>` pointing at (e).
 *        g. Open a PR `head: <new-branch>, base: <default-branch>`.
 *
 * Token requirements: the GITHUB_TOKEN secret must have `contents:write`
 * + `pull_requests:write` access to the target repo. Same-repo PR only;
 * fork-and-PR is intentionally out of scope (see spec). On 403, we
 * surface a clear error pointing at the token.
 *
 * Idempotency: each call uses a millisecond-stamped branch name, so
 * multiple invocations against the same repo produce multiple PRs
 * rather than colliding. Closing or merging old PRs is left to the user.
 */
export async function openDocumentationPR(
  input: OpenDocumentationPRInput,
): Promise<OpenDocumentationPROutput> {
  // 1. Validate repo + docsStatus.
  const repo = await Repositories.get(input.repositoryId);
  if (!repo) throw new Error('Repository not found.');
  if (repo.docsStatus !== 'completed') {
    throw new Error(
      `Documentation generation has not completed for this repository (docsStatus="${repo.docsStatus ?? 'idle'}"). Run Generate Bible and wait for it to finish before opening a PR.`,
    );
  }

  // GITHUB_TOKEN is REQUIRED for write operations. If absent, fail fast
  // with a useful message instead of getting a 401 from GitHub.
  if (!process.env.GITHUB_TOKEN) {
    throw new Error(
      'GITHUB_TOKEN is not configured. Set it in the Secrets tab with a token that has contents:write and pull_requests:write permissions on the target repository.',
    );
  }

  const parsed = parseGitHubUrl(repo.githubUrl);

  // Re-fetch repo metadata to learn the live default branch (might have
  // changed since ingestion). The PR is opened against this branch.
  const repoInfo = await fetchRepoInfo(parsed);
  const defaultBranch = repoInfo.default_branch;

  // 2. Collect latest docs.
  const [files, allDocs] = await Promise.all([
    Files.filter(
      (f, $) => f.repoId === $.repoId,
      { repoId: repo.id }, // bindings: lifts closure var so filter compiles to SQL
    ),
    GeneratedDocs.filter(
      (d, $) => d.repoId === $.repoId,
      { repoId: repo.id }, // bindings: lifts closure var so filter compiles to SQL
    ),
  ]);

  // Keyed selection: latest `repo_overview` by created_at, latest
  // `file_deepdive` per fileId by created_at.
  let latestOverview: { markdownContent: string; created_at: number } | null = null;
  const latestByFileId = new Map<string, { markdownContent: string; created_at: number }>();
  for (const d of allDocs) {
    if (d.docType === 'repo_overview') {
      if (!latestOverview || d.created_at > latestOverview.created_at) {
        latestOverview = d;
      }
    } else if (d.docType === 'file_deepdive' && d.fileId) {
      const existing = latestByFileId.get(d.fileId);
      if (!existing || d.created_at > existing.created_at) {
        latestByFileId.set(d.fileId, d);
      }
    }
  }

  // 3. Materialize path → content map.
  const filesByPath: Record<string, string> = {};
  if (latestOverview) {
    filesByPath['docs/ARCHITECTURE.md'] = latestOverview.markdownContent;
  }
  for (const file of files) {
    const doc = latestByFileId.get(file.id);
    if (doc) {
      filesByPath[`docs/${file.filePath}.bible.md`] = doc.markdownContent;
    }
  }

  if (Object.keys(filesByPath).length === 0) {
    throw new Error(
      'No documentation rows were found for this repository. Run Generate Bible first.',
    );
  }

  // 4. Git Data API dance.
  // (a) + (b): resolve base commit + tree.
  const baseCommitSha = await fetchBranchHead(parsed, defaultBranch);
  const baseTreeSha = await fetchCommitTreeSha(parsed, baseCommitSha);

  // (c) Create blobs concurrently.
  const pathContentEntries = Object.entries(filesByPath);
  const blobEntries: Array<{ path: string; sha: string }> = [];
  let inFlight = 0;
  let cursor = 0;
  await new Promise<void>((resolve, reject) => {
    let firstError: unknown = null;
    const dispatch = () => {
      if (firstError) return; // stop fanning out on first error
      while (inFlight < BLOB_CONCURRENCY && cursor < pathContentEntries.length) {
        const idx = cursor++;
        const [path, content] = pathContentEntries[idx];
        inFlight++;
        createBlob(parsed, content)
          .then((sha) => blobEntries.push({ path, sha }))
          .catch((err) => {
            if (!firstError) firstError = err;
          })
          .finally(() => {
            inFlight--;
            if (firstError && inFlight === 0) reject(firstError);
            else if (cursor === pathContentEntries.length && inFlight === 0) resolve();
            else dispatch();
          });
      }
    };
    dispatch();
  });

  // (d) Build new tree.
  const newTreeSha = await createTree(parsed, baseTreeSha, blobEntries);

  // (e) Create commit.
  const commitMessage = 'docs: Auto-Generated Codebase Bible';
  const newCommitSha = await createCommit(
    parsed,
    commitMessage,
    newTreeSha,
    baseCommitSha,
  );

  // (f) Create branch. Millisecond suffix avoids collisions with prior runs.
  const branchName = `codebase-bible-${Date.now()}`;
  await createBranch(parsed, branchName, newCommitSha);

  // (g) Open PR.
  const prBody = buildPrBody({
    repoName: repo.repoName,
    fileCount: blobEntries.length,
    hasOverview: !!latestOverview,
  });
  const pr = await openPullRequest(parsed, {
    title: 'docs: Auto-Generated Codebase Bible',
    head: branchName,
    base: defaultBranch,
    body: prBody,
  });

  console.log(
    `[openDocumentationPR] ${repo.repoName}: opened PR #${pr.number} at ${pr.url} on branch ${branchName} with ${blobEntries.length} files`,
  );

  return {
    prUrl: pr.url,
    prNumber: pr.number,
    branch: branchName,
    fileCount: blobEntries.length,
  };
}

/**
 * Compose the PR body. Uses straightforward markdown — no tables of
 * file lists (those would balloon the PR description on a 200-file
 * repo); the diff itself shows the file list.
 */
function buildPrBody(args: {
  repoName: string;
  fileCount: number;
  hasOverview: boolean;
}): string {
  return [
    `# Codebase Bible`,
    ``,
    `This pull request adds machine-generated technical documentation for **${args.repoName}**.`,
    ``,
    `## What is in this PR`,
    ``,
    args.hasOverview
      ? `- \`docs/ARCHITECTURE.md\` — a high-level architecture summary with a Mermaid flowchart of the primary data flow.`
      : null,
    `- \`docs/<source-path>.bible.md\` — one technical writeup per source file, walking through purpose, architecture, public interface, internal logic, dependencies, and edge cases.`,
    ``,
    `Total: ${args.fileCount} markdown file${args.fileCount === 1 ? '' : 's'}.`,
    ``,
    `## How it was made`,
    ``,
    `1. Source files were chunked along logical boundaries (functions, classes, paragraphs) with a 4,000-char target and a 400-char overlap so context is preserved across chunks.`,
    `2. Each chunk was embedded with \`text-embedding-3-small\` (1536-dim).`,
    `3. A Mapper agent read the file tree and produced \`ARCHITECTURE.md\`.`,
    `4. A Deep-Dive agent then ran one pass per file, grounded in the architecture context and constrained to the actual source code (close-world prompt rules to prevent hallucination).`,
    ``,
    `Both agents are Claude 4.6 Sonnet via the MindStudio service router. Adaptive thinking is enabled for the Mapper and disabled for the Deep-Dive.`,
    ``,
    `## Caveats`,
    ``,
    `- The writeups cite code from the file they describe but do not currently retrieve cross-file context. Statements about other modules are based on the architecture summary alone.`,
    `- Treat this as a starting point. Review and edit as you would any first draft.`,
    ``,
    `Generated by [Codebase Bible](https://github.com).`,
  ]
    .filter((line) => line !== null)
    .join('\n');
}
