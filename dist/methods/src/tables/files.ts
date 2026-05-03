import { db } from '@mindstudio-ai/agent';

/**
 * A single source file discovered inside a repository during ingestion.
 * Owned by exactly one repository.
 *
 * The interface is named `RepoFile` rather than `File` to avoid colliding
 * with the global DOM `File` type. The exported table is still `Files`.
 *
 * System columns (`id`, `created_at`, `updated_at`, `last_updated_by`) are
 * provided automatically by the platform and must not be redeclared here.
 */
interface RepoFile {
  // FK -> repositories.id. Cascading delete enforced in application code.
  repoId: string;

  // Path relative to the repo root, e.g. "src/lib/auth.ts".
  // Always stored with forward slashes regardless of source OS.
  filePath: string;

  // Detected language label, e.g. "typescript", "python", "go", "markdown",
  // "unknown". Free-form string in this step; vocabulary may be tightened
  // later without a schema change.
  language: string;
}

export const Files = db.defineTable<RepoFile>('files', {
  // A given path appears at most once per repo. Lets re-ingestion `upsert`
  // on (repoId, filePath) rather than duplicate rows.
  unique: [['repoId', 'filePath']],
});
