import { db } from '@mindstudio-ai/agent';

/**
 * A GitHub repository the user has added to the system.
 *
 * System columns (`id`, `created_at`, `updated_at`, `last_updated_by`) are
 * provided automatically by the platform and must not be redeclared here.
 */
/** Lifecycle of a repository's ingestion run. */
export type RepositoryStatus =
  | 'pending' // row exists, ingestion not yet started (reserved for future queueing)
  | 'processing' // ingestion is currently running in the background
  | 'completed' // last ingestion finished successfully
  | 'failed'; // last ingestion crashed; see `console.error` logs for details

interface Repository {
  // Full HTTPS URL to the repo, e.g. "https://github.com/owner/name".
  // Logical unique key for the table.
  githubUrl: string;

  // Display name, typically derived from the URL ("owner/name").
  // Stored separately so the UI does not re-parse on every render.
  repoName: string;

  // Lifecycle of the most recent ingestion run. The column is typed as
  // `string` at the DB level (SQLite has no enums); the values are
  // restricted via the `RepositoryStatus` type alias above and enforced
  // by the call sites that write this column.
  status: RepositoryStatus;

  // Unix-ms timestamp of the most recent SUCCESSFUL ingestion run.
  // `undefined` until the first scan reaches `status === 'completed'`.
  // Deliberately not bumped on transitions to 'processing' or 'failed' —
  // the column should answer "when did we last have a complete picture
  // of this repo?" rather than "when did we last touch the row?". Use the
  // auto-managed `updated_at` for the latter.
  lastScannedAt?: number;
}

export const Repositories = db.defineTable<Repository>('repositories', {
  // Required so re-ingestion of an already-known repo can `upsert` on URL
  // instead of creating a duplicate row.
  unique: [['githubUrl']],
});
