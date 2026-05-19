/**
 * Smart text chunker for source files and prose.
 *
 * Strategy:
 *   1. Split the input into "blocks" along logical boundaries — runs of
 *      blank lines, plus declaration-line breaks (function / class /
 *      def / impl / heading) at column 0. This keeps semantic units
 *      together as much as possible without invoking a real AST parser.
 *   2. Greedy-pack blocks into chunks up to ~4,000 characters. When a
 *      new block would push us over the limit, flush the current chunk
 *      and start a new one whose first ~400 characters are an overlap
 *      tail copied from the end of the just-flushed chunk. The overlap
 *      preserves context so a function or paragraph that straddles a
 *      chunk boundary is still readable from either side.
 *   3. Any single block that is itself larger than the limit (e.g. a
 *      huge minified line, or a giant function we can't subdivide) gets
 *      sliding-window split with the same overlap.
 *
 * The 4,000-char target corresponds to roughly 1,000 tokens for the
 * `text-embedding-3-small` tokenizer, well inside the model's 8,191-token
 * input cap. The 400-char overlap is 10% per the spec.
 */

const DEFAULT_MAX_CHARS = 4_000;
const DEFAULT_OVERLAP = 400;

/**
 * Regex that matches "natural break points". Split is triggered by
 * either:
 *   - a run of blank lines (one or more empty / whitespace-only lines), OR
 *   - the start of a line that begins (after optional indentation) with a
 *     declaration keyword common in code we ingest.
 *
 * The lookbehind `\n` keeps the newline terminator on the previous block
 * so the joined output stays readable.
 */
const SPLIT_PATTERN =
  /\n\s*\n+|\n(?=\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|class|interface|type|enum|namespace|module|struct|impl|trait|fn|def|public|private|protected|static)\b)|\n(?=#{1,6}\s)/g;

/** Options for chunkText. */
export interface ChunkOptions {
  maxChars?: number;
  overlap?: number;
}

/**
 * Split a long string into chunks ready for embedding.
 *
 * Always returns at least one chunk for any non-empty input. Empty /
 * whitespace-only inputs return `[]`.
 */
export function chunkText(text: string, opts: ChunkOptions = {}): string[] {
  const maxChars = opts.maxChars ?? DEFAULT_MAX_CHARS;
  const overlap = opts.overlap ?? DEFAULT_OVERLAP;

  if (!text || text.trim().length === 0) return [];

  // Inputs that fit in a single chunk skip the rest of the pipeline.
  if (text.length <= maxChars) return [text];

  // Step 1: split into blocks along logical boundaries. Empty / blank
  // segments are dropped to keep the greedy pack tidy.
  const blocks = text
    .split(SPLIT_PATTERN)
    .map((b) => b.replace(/\s+$/, '')) // trim trailing whitespace per block
    .filter((b) => b.length > 0);

  // Step 2: greedy pack with overlap.
  const chunks: string[] = [];
  let current = '';

  const flush = () => {
    if (current.length > 0) chunks.push(current);
  };

  for (const rawBlock of blocks) {
    // Step 3 (early): if the block alone is bigger than maxChars, the
    // greedy step can't take it whole. We flush whatever we have and
    // hand the oversize block to the windowed splitter.
    if (rawBlock.length > maxChars) {
      flush();
      current = '';
      const sub = splitByWindow(rawBlock, maxChars, overlap);
      // Append all but the last sub-chunk directly. Keep the last one
      // as `current` so the next block can still pack onto it.
      for (let i = 0; i < sub.length - 1; i++) chunks.push(sub[i]);
      current = sub[sub.length - 1] ?? '';
      continue;
    }

    const candidate = current ? current + '\n\n' + rawBlock : rawBlock;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    // Doesn't fit. Flush, then start a new chunk seeded with overlap
    // from the end of what we just flushed.
    flush();
    const tail = current.slice(-overlap);
    current = tail ? tail + '\n\n' + rawBlock : rawBlock;
  }

  flush();

  // Belt-and-suspenders: if the seeded "tail + block" combination ever
  // exceeded maxChars (shouldn't normally, but possible), re-split.
  return chunks.flatMap((c) =>
    c.length > maxChars ? splitByWindow(c, maxChars, overlap) : [c],
  );
}

/**
 * Sliding-window splitter for a single oversize string. Stride is
 * `maxChars - overlap` so consecutive windows share `overlap` characters
 * of context.
 */
function splitByWindow(text: string, maxChars: number, overlap: number): string[] {
  const out: string[] = [];
  const stride = Math.max(1, maxChars - overlap);
  for (let i = 0; i < text.length; i += stride) {
    out.push(text.slice(i, i + maxChars));
    if (i + maxChars >= text.length) break;
  }
  return out;
}

/**
 * Coarse chunk-type classifier. We don't have a real AST, so we sniff
 * the chunk's content for declaration- and prose-like signals.
 *
 * Returns one of:
 *   - `'code'`          — clearly source code (declarations, imports, semicolons, braces)
 *   - `'documentation'` — clearly prose (markdown headings, list bullets, links)
 *   - `'mixed'`         — neither dominates (e.g. heavy JSDoc-laden TS file)
 */
export function classifyChunkType(content: string): 'code' | 'documentation' | 'mixed' {
  if (!content) return 'mixed';

  // Code signals: declaration keywords at line starts, semicolons, braces,
  // `import`/`from` lines, `=>`. Counted via line-anchored regex.
  const codeMatches =
    (content.match(
      /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|class|interface|type|enum|const|let|var|import|from|public|private|protected|static|fn|impl|struct|trait|def|module|package)\b/gm,
    ) || []).length;

  // Documentation signals: markdown headings (#..######), list bullets
  // at line starts, blockquotes (>), and inline links `[x](y)`.
  const docMatches =
    (content.match(/^\s*(?:#{1,6}\s|[*+-]\s|>\s)/gm) || []).length +
    (content.match(/\[[^\]]+\]\([^)]+\)/g) || []).length;

  if (codeMatches >= docMatches * 2 && codeMatches > 0) return 'code';
  if (docMatches >= codeMatches * 2 && docMatches > 0) return 'documentation';
  // Files with neither (config, plain text) default to 'code' — they're
  // closer to "structured input" than "prose."
  if (codeMatches === 0 && docMatches === 0) return 'code';
  return 'mixed';
}
