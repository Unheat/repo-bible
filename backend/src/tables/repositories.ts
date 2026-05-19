// TODO: REPLACE THIS ENTIRE FILE WITH PRISMA MODELS
// This file uses db.defineTable from @mindstudio-ai/agent
// It will be completely replaced with Prisma-generated models from backend/src/db/
// See backend/prisma/schema.prisma for the new schema definition
// import { db } from '@mindstudio-ai/agent';

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

/** Lifecycle of the AI documentation-generation pass (separate from ingestion). */
export type DocsStatus =
  | 'idle' // no run has been started, or the previous run was cleared
  | 'generating' // generateBible is currently running in the background
  | 'completed' // last run finished and writeups are available
  | 'failed'; // last run crashed; see `console.error` logs for details

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

  // Lifecycle of the most recent AI doc-generation run. Independent of
  // `status` (which tracks ingestion). `idle` means no docs have been
  // generated for this repo yet. Optional in the interface so existing
  // rows that pre-date this column read as `undefined` and can be
  // treated as `idle` by call sites.
  docsStatus?: DocsStatus;

  // Unix-ms timestamp of the most recent SUCCESSFUL ingestion run.
  // `undefined` until the first scan reaches `status === 'completed'`.
  // Deliberately not bumped on transitions to 'processing' or 'failed' —
  // the column should answer "when did we last have a complete picture
  // of this repo?" rather than "when did we last touch the row?". Use the
  // auto-managed `updated_at` for the latter.
  lastScannedAt?: number;
}

// export const Repositories = db.defineTable<Repository>('repositories', {
//   // Required so re-ingestion of an already-known repo can `upsert` on URL
//   // instead of creating a duplicate row.
//   unique: [['githubUrl']],
// });

// Placeholder export to prevent import errors
export const Repositories = {} as any;
