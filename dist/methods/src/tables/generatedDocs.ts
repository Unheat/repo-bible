import { db } from '@mindstudio-ai/agent';

/**
 * Markdown documentation produced by the AI agents.
 *
 * Two flavors live in this table:
 *   - `repo_overview` — a single high-level architecture summary + Mermaid
 *     flowchart for an entire repository. `fileId` is `undefined`. One row
 *     per generation; latest wins on read.
 *   - `file_deepdive` — a per-file technical writeup. `fileId` is set.
 *     Multiple rows per file are valid and intentional; re-running the
 *     agents must not destroy previous output. Latest is chosen at read
 *     time via `sortBy(d => d.created_at).reverse().take(1)`.
 *
 * `repoId` is denormalized onto every row (even though it can be derived
 * from `files.repoId` for file-deepdive rows) so cascade-delete and
 * "all docs for this repo" queries are single-table operations.
 *
 * System columns (`id`, `created_at`, `updated_at`, `last_updated_by`) are
 * provided automatically by the platform and must not be redeclared here.
 */

/** What kind of documentation this row represents. */
export type DocType = 'repo_overview' | 'file_deepdive';

interface GeneratedDoc {
  // FK -> repositories.id. Required on every row. Cascade-delete from a
  // removed repository targets this column directly.
  repoId: string;

  // FK -> files.id. Required for `file_deepdive` rows; `undefined` for
  // `repo_overview` rows. Cascade-delete from a removed file targets
  // this column.
  fileId?: string;

  // Discriminator. Free-form `string` at the column level (SQLite has no
  // enums); the `DocType` alias above is enforced by the call sites that
  // write this column.
  docType: DocType;

  // The full markdown body produced by the LLM. May embed Mermaid
  // flowchart blocks; rendering is a frontend concern. Stored as-is.
  markdownContent: string;
}

// No unique constraint. Re-running the agents intentionally appends new
// rows so generation history is preserved. "Latest doc" is a query, not
// a uniqueness rule.
export const GeneratedDocs = db.defineTable<GeneratedDoc>('generated_docs');
