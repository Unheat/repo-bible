import { db } from '@mindstudio-ai/agent';

/**
 * A GitHub repository the user has added to the system.
 *
 * System columns (`id`, `created_at`, `updated_at`, `last_updated_by`) are
 * provided automatically by the platform and must not be redeclared here.
 */
interface Repository {
  // Full HTTPS URL to the repo, e.g. "https://github.com/owner/name".
  // Logical unique key for the table.
  githubUrl: string;

  // Display name, typically derived from the URL ("owner/name").
  // Stored separately so the UI does not re-parse on every render.
  repoName: string;

  // Unix-ms timestamp of the most recent successful ingestion run.
  // `undefined` until the first scan completes; updated on every re-scan.
  // Distinct from the auto-managed `updated_at`, which moves on any write.
  lastScannedAt?: number;
}

export const Repositories = db.defineTable<Repository>('repositories', {
  // Required so re-ingestion of an already-known repo can `upsert` on URL
  // instead of creating a duplicate row.
  unique: [['githubUrl']],
});
