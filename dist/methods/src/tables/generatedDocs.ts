import { db } from '@mindstudio-ai/agent';

/**
 * Markdown documentation produced by the AI agents for a given file.
 * Multiple rows per file are intentional so the history of generated docs
 * is preserved across re-runs of the agents.
 *
 * Note: `createdAt` is intentionally NOT redeclared. The platform provides
 * a system `created_at` column on every row (unix ms) which serves the
 * "generated on ..." UI value. Adding a separate `createdAt` would create
 * a confusing duplicate. Read `doc.created_at` directly.
 *
 * System columns (`id`, `created_at`, `updated_at`, `last_updated_by`) are
 * provided automatically by the platform and must not be redeclared here.
 */
interface GeneratedDoc {
  // FK -> files.id. Cascading delete enforced in application code.
  fileId: string;

  // The full markdown body produced by the Deep-Dive agent (or, in some
  // flows, the Mapper). May embed Mermaid flowchart blocks; rendering is
  // a frontend concern. Stored as-is.
  markdownContent: string;
}

// No unique constraint: multiple generations per file are valid and
// intentional. Re-running the agents must not destroy previous output.
// "Latest doc for a file" is a query
// (`sortBy(d => d.created_at).reverse().take(1)`), not a uniqueness rule.
export const GeneratedDocs = db.defineTable<GeneratedDoc>('generated_docs');
