import { db } from '@mindstudio-ai/agent';
import { Repositories } from './tables/repositories';
import { Files } from './tables/files';
import {
  parseGitHubUrl,
  fetchRepoInfo,
  fetchRepoTree,
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
  /** Number of files persisted after filtering. */
  fileCount: number;
  /** Number of tree blobs filtered out. */
  filteredCount: number;
  /** True when the GitHub tree response was truncated. */
  truncated: boolean;
}

/**
 * Step 2 of the Codebase Bible pipeline: ingest a GitHub repository.
 *
 * Pipeline:
 *   1. Parse and canonicalize the URL.
 *   2. Fetch repo metadata to learn the default branch.
 *   3. Fetch the recursive file tree for that branch.
 *   4. Filter out boilerplate dirs, lockfiles, binaries, minified bundles,
 *      and oversized files.
 *   5. Upsert the repository row (keyed on canonical URL).
 *   6. Upsert each surviving file row (keyed on (repoId, filePath)) so
 *      re-ingestion updates in place rather than creating duplicates.
 *   7. Invoke the `chunkAndEmbedFile` placeholder for each file. Step 3
 *      will replace the placeholder body with the real chunking and
 *      embedding logic, and will likely also move ingestion to a
 *      fire-and-forget background task with a `status` column on
 *      `repositories`. For Step 2 the placeholder is cheap, so we run
 *      synchronously.
 *
 * Re-ingestion semantics: stale files (rows that exist in the DB but no
 * longer in the repo tree) are NOT removed in this step. That cleanup
 * pass is deliberately deferred to a later step.
 */
export async function ingestRepository(
  input: IngestRepositoryInput,
): Promise<IngestRepositoryOutput> {
  // Step 1: parse the URL.
  const parsed = parseGitHubUrl(input.githubUrl);

  // Step 2: fetch repo metadata so we know the default branch.
  const repoInfo = await fetchRepoInfo(parsed);
  const defaultBranch = repoInfo.default_branch;

  // Step 3: fetch the recursive file tree.
  const tree = await fetchRepoTree(parsed, defaultBranch);

  // Step 4: filter to text-only blobs we want to index.
  const allBlobs = tree.tree.filter((n): n is TreeNode => n.type === 'blob');
  const validBlobs: TreeNode[] = [];
  let filteredCount = 0;
  for (const node of allBlobs) {
    const decision = shouldIngest(node.path, node.size);
    if (decision.keep) {
      validBlobs.push(node);
    } else {
      filteredCount++;
    }
  }

  // Step 5: upsert the repository row. `lastScannedAt` is updated to "now"
  // because by the time this method returns, the file tree on the row
  // reflects the current head of the default branch.
  const now = Date.now();
  const repo = await Repositories.upsert('githubUrl', {
    githubUrl: parsed.canonicalUrl,
    repoName: `${parsed.owner}/${parsed.name}`,
    lastScannedAt: now,
  });

  // Step 6: upsert files in batches. Sanity-check guidance is to stay
  // around 100-200 mutations per batch.
  const BATCH_SIZE = 100;
  const insertedFileIds: string[] = [];
  for (let i = 0; i < validBlobs.length; i += BATCH_SIZE) {
    const slice = validBlobs.slice(i, i + BATCH_SIZE);
    const mutations = slice.map((node) =>
      Files.upsert(['repoId', 'filePath'], {
        repoId: repo.id,
        filePath: node.path,
        language: detectLanguage(node.path),
      }),
    );
    // db.batch spread loses the tuple type for homogeneous arrays; cast
    // back to the known row shape (each upsert resolves to a Files row).
    const inserted = (await db.batch(...mutations)) as Array<{ id: string }>;
    for (const row of inserted) {
      insertedFileIds.push(row.id);
    }
  }

  // Step 7: invoke the placeholder once per persisted file. Step 3 will
  // expand this to fetch raw content from GitHub and pass it through.
  for (const fileId of insertedFileIds) {
    await chunkAndEmbedFile(fileId, '');
  }

  console.log(
    `[ingestRepository] ${parsed.canonicalUrl}: ${insertedFileIds.length} files ingested, ${filteredCount} filtered out, branch=${defaultBranch}, truncated=${tree.truncated}`,
  );

  return {
    repositoryId: repo.id,
    repoName: repo.repoName,
    defaultBranch,
    fileCount: insertedFileIds.length,
    filteredCount,
    truncated: tree.truncated === true,
  };
}
