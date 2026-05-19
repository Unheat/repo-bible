// TODO: REPLACE THIS ENTIRE FILE WITH PRISMA MODELS
// This file uses db.defineTable from @mindstudio-ai/agent
// It will be completely replaced with Prisma-generated models from backend/src/db/
// See backend/prisma/schema.prisma for the new schema definition
// import { db } from '@mindstudio-ai/agent';

/**
 * A semantic unit extracted from a file by the AST parser. A single file
 * produces many chunks. Each chunk carries its source text, a coarse type
 * label, and an embedding vector for retrieval.
 *
 * System columns (`id`, `created_at`, `updated_at`, `last_updated_by`) are
 * provided automatically by the platform and must not be redeclared here.
 */
interface CodeChunk {
  // FK -> files.id. Cascading delete enforced in application code.
  fileId: string;

  // The exact source text of the chunk, preserved verbatim (whitespace and
  // all) so retrieval results can be shown to the user as-is.
  chunkText: string;

  // Coarse category produced by the AST parser. Initial vocabulary:
  // "function" | "class" | "method" | "interface" | "type" | "import"
  // | "boilerplate" | "comment" | "other". Free-form at the column level;
  // the parser is responsible for staying within the agreed set.
  chunkType: string;

  // Embedding vector, stored as a JSON array of floats. Length is whatever
  // the embedding model produces (e.g. 1536 for text-embedding-3-small);
  // not constrained at the schema level, so the model can be swapped
  // without a migration. Cosine similarity is computed in-process by
  // methods at query time for the MVP.
  embedding: number[];
}

// No unique constraint: a file can produce many chunks, and identical
// chunk text can legitimately recur (boilerplate, repeated imports).
// De-duplication, if desired, is a pipeline concern, not a schema rule.
// export const CodeChunks = db.defineTable<CodeChunk>('code_chunks');

// Placeholder export to prevent import errors
export const CodeChunks = {} as any;
