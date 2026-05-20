### 1. File Purpose
This file provides a smart text chunking utility for source files and prose, designed to prepare text for embedding by language models. It splits long text into manageable chunks (targeting ~4,000 characters) while preserving semantic context through logical boundary detection and overlap. The chunker is used during repository ingestion to process file contents before embedding and storage.

### 2. Architecture and Design Patterns
This file implements a **strategy pattern** for chunking: it uses configurable strategies (greedy packing with overlap, sliding-window splitting for oversize blocks) to handle different text sizes. It fits into the broader architecture as a utility library (`lib/`) used by the ingestion pipeline (`ingestRepository.ts`), which processes repository files before storing them in the database. The chunker operates independently of the database or API layers, focusing solely on text transformation.

### 3. Public Interface

#### `chunkText`
```typescript
export function chunkText(text: string, opts: ChunkOptions = {}): string[]
```
- **Parameters**:
  - `text: string`: The input text to chunk.
  - `opts: ChunkOptions` (optional): Configuration options.
- **Return Type**: `string[]` — An array of text chunks.
- **Purpose**: Splits input text into chunks suitable for embedding, using greedy packing with overlap. Returns an empty array for empty/whitespace-only input.

#### `classifyChunkType`
```typescript
export function classifyChunkType(content: string): 'code' | 'documentation' | 'mixed'
```
- **Parameters**:
  - `content: string`: The chunk content to classify.
- **Return Type**: `'code' | 'documentation' | 'mixed'` — A classification based on content signals.
- **Purpose**: Coarsely classifies a chunk as code, documentation, or mixed, using regex-based signal detection (e.g., declaration keywords, markdown patterns).

#### `ChunkOptions`
```typescript
export interface ChunkOptions {
  maxChars?: number;
  overlap?: number;
}
```
- **Purpose**: Configuration interface for `chunkText`, allowing customization of chunk size and overlap.

### 4. Internal Logic Walkthrough
The `chunkText` function follows a three-step strategy:

1. **Split into logical blocks**: The input text is split using `SPLIT_PATTERN`, which matches blank lines or declaration keywords at line starts. This keeps semantic units together.
   ```typescript
   const blocks = text
     .split(SPLIT_PATTERN)
     .map((b) => b.replace(/\s+$/, '')) // trim trailing whitespace per block
     .filter((b) => b.length > 0);
   ```

2. **Greedy packing with overlap**: Blocks are packed into chunks up to `maxChars`. If a block doesn't fit, the current chunk is flushed, and a new chunk is seeded with an overlap tail from the previous chunk.
   ```typescript
   for (const rawBlock of blocks) {
     // Step 3 (early): if the block alone is bigger than maxChars...
     if (rawBlock.length > maxChars) {
       flush();
       current = '';
       const sub = splitByWindow(rawBlock, maxChars, overlap);
       for (let i = 0; i < sub.length - 1; i++) chunks.push(sub[i]);
       current = sub[sub.length - 1] ?? '';
       continue;
     }

     const candidate = current ? current + '\n\n' + rawBlock : rawBlock;
     if (candidate.length <= maxChars) {
       current = candidate;
       continue;
     }

     // Doesn't fit. Flush, then start a new chunk seeded with overlap...
     flush();
     const tail = current.slice(-overlap);
     current = tail ? tail + '\n\n' + rawBlock : rawBlock;
   }
   ```

3. **Handle oversize blocks**: If a single block exceeds `maxChars`, it's split using a sliding-window approach (`splitByWindow`), which creates overlapping chunks with a stride of `maxChars - overlap`.
   ```typescript
   function splitByWindow(text: string, maxChars: number, overlap: number): string[] {
     const out: string[] = [];
     const stride = Math.max(1, maxChars - overlap);
     for (let i = 0; i < text.length; i += stride) {
       out.push(text.slice(i, i + maxChars));
       if (i + maxChars >= text.length) break;
     }
     return out;
   }
   ```

The `classifyChunkType` function uses regex to count code and documentation signals, returning a classification based on relative counts. This helps downstream processes (e.g., LLM prompts) tailor handling per chunk type.

### 5. Dependencies and Integrations
- **Internal imports**: None in this file. It is a standalone utility.
- **External dependencies**: None explicitly imported. The file uses only TypeScript and standard JavaScript APIs (e.g., `String.prototype.split`, `match`).
- **Integration points**: Used by `ingestRepository.ts` (implementation not in scope) to chunk file contents before embedding and storage.

### 6. Edge Cases and Error Handling
- **Empty input**: Returns an empty array if `text` is empty or whitespace-only.
- **Oversize blocks**: Handled via `splitByWindow`, which ensures chunks never exceed `maxChars` even for single large blocks.
- **Overlap seeding**: When starting a new chunk, the tail of the previous chunk (up to `overlap` characters) is prepended to preserve context.
- **Belt-and-suspenders check**: After packing, any chunk exceeding `maxChars` is re-split using `splitByWindow` (though this should not occur under normal conditions).
- **Classification fallback**: If no code or documentation signals are found, `classifyChunkType` defaults to `'code'`.

### 7. Observations
- **Code duplication**: The loop body in `chunkText` contains duplicated logic for handling candidate chunks (lines 73-85 and 95-107 appear identical), which may indicate a copy-paste error. This could lead to maintenance issues.
- **Regex complexity**: The `SPLIT_PATTERN` uses a complex regex with lookaheads and alternations, which may be hard to maintain or extend for new language constructs.
- **Overlap calculation**: The overlap is applied as a tail from the previous chunk, but for oversize blocks, the sliding window uses a fixed stride. This may not always preserve optimal context for very large blocks.
- **No error handling for invalid options**: If `maxChars` or `overlap` are set to invalid values (e.g., negative), the function may behave unexpectedly (e.g., `stride` could become zero in `splitByWindow`).