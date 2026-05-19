/**
 * Chunk a file's raw content, embed each chunk, and persist the results
 * to the `code_chunks` table.
 *
 * Step 3 implementation. Public signature is unchanged from the Step 2
 * placeholder so the call site in `ingestRepository` does not move.
 *
 * Behavior:
 *   1. Drop any existing `code_chunks` rows for `fileId` so re-ingestion
 *      replaces rather than duplicates. (Cascading delete from a removed
 *      `files` row is handled separately by the cascade-delete helper;
 *      this is the intra-file cleanup that keeps re-ingest idempotent.)
 *   2. Run the smart chunker over `rawContent` (max ~4,000 chars per
 *      chunk, 400-char overlap, logical-boundary aware).
 *   3. Embed all chunks in a single batched call to the OpenAI-compatible
 *      embeddings endpoint. Failures are logged and that file's run
 *      yields zero new chunks instead of crashing the pipeline.
 *   4. Batch-insert successful chunks into `code_chunks` in groups of
 *      100 to keep individual `db.batch` payloads tidy.
 */

// TODO: Migrate this to Prisma
// import { db } from '@mindstudio-ai/agent';
// import { CodeChunks } from '../tables/codeChunks';
import { prisma } from '../db/prisma.js';
import { chunkText, classifyChunkType } from './textChunker';
import { embedTexts, EMBEDDING_DIMENSIONS } from './openaiClient';

/** Batch size for `code_chunks` inserts. Stays below the soft cap of ~200. */
const INSERT_BATCH_SIZE = 100;

export interface ChunkAndEmbedResult {
  /** Chunks successfully embedded and persisted. */
  chunkCount: number;
  /** Chunks that were generated but failed to embed (for diagnostics). */
  failedChunkCount: number;
}

export async function chunkAndEmbedFile(
  fileId: string,
  rawContent: string,
): Promise<ChunkAndEmbedResult> {
  // TODO: Migrate this to Prisma
  throw new Error('chunkAndEmbedFile not yet migrated to Prisma');
  
  // // 1. Wipe prior chunks for this file so re-ingestion is idempotent.
  // //    `removeAll` with bindings compiles to a single DELETE WHERE.
  // await CodeChunks.removeAll(
  //   (c, $) => c.fileId === $.fileId,
  //   { fileId }, // bindings: lifts closure var so removeAll compiles to SQL
  // );

  // // 2. Chunk. Empty / whitespace-only files produce zero chunks and exit.
  // const pieces = chunkText(rawContent);
  // if (pieces.length === 0) {
  //   return { chunkCount: 0, failedChunkCount: 0 };
  // }

  // // 3. Embed in a single batched request.
  // const vectors = await embedTexts(pieces);

  // // 4. Build the rows we will persist. Skip slots where the embedding
  // //    came back null (rate-limited after retry, or unrecoverable error).
  // type ChunkRow = {
  //   fileId: string;
  //   chunkText: string;
  //   chunkType: string;
  //   embedding: number[];
  // };
  // const rows: ChunkRow[] = [];
  // let failed = 0;
  // pieces.forEach((piece, i) => {
  //   const vec = vectors[i];
  //   if (!vec) {
  //     failed++;
  //     return;
  //   }
  //   if (vec.length !== EMBEDDING_DIMENSIONS) {
  //     // Unexpected dimensionality — log but still persist so downstream
  //     // code can detect and migrate. Common with model swaps.
  //     console.warn(
  //       `[chunkAndEmbedFile] unexpected embedding dim ${vec.length} (expected ${EMBEDDING_DIMENSIONS}) for fileId=${fileId} chunk ${i}`,
  //     );
  //   }
  //   rows.push({
  //     fileId,
  //     chunkText: piece,
  //     chunkType: classifyChunkType(piece),
  //     embedding: vec,
  //   });
  // });

  // // 5. Persist in batches.
  // for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
  //   const slice = rows.slice(i, i + INSERT_BATCH_SIZE);
  //   const mutations = slice.map((r) => CodeChunks.push(r));
  //   await db.batch(...mutations);
  // }

  // if (failed > 0) {
  //   console.warn(
  //     `[chunkAndEmbedFile] fileId=${fileId} persisted ${rows.length} chunks, ${failed} failed to embed`,
  //   );
  // } else {
  //   console.log(
  //     `[chunkAndEmbedFile] fileId=${fileId} persisted ${rows.length} chunks`,
  //   );
  // }

  // return { chunkCount: rows.length, failedChunkCount: failed };
}
