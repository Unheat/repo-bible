/**
 * Embedding client.
 *
 * Wraps the official `openai` SDK pointed at whatever OpenAI-compatible
 * endpoint the user has configured via secrets. In production we point
 * `OPENAI_BASE_URL` at OpenRouter (`https://openrouter.ai/api/v1`); the
 * SDK speaks OpenAI's wire format and OpenRouter accepts the same shape,
 * so the same code works against either backend.
 *
 * Secrets required (set in the MindStudio Secrets tab):
 *   - `OPENAI_API_KEY`  — credential
 *   - `OPENAI_BASE_URL` — e.g. `https://openrouter.ai/api/v1`
 *
 * If `OPENAI_BASE_URL` is not set we fall back to the OpenAI default
 * (`https://api.openai.com/v1`), which lets developers point straight at
 * OpenAI without changing code.
 */

import OpenAI from 'openai';

/**
 * Embedding model identifier. NOTE the `openai/` prefix — required for
 * OpenRouter to route to the OpenAI provider. Stripped automatically by
 * `getEffectiveModelId` when the configured base URL is the bare
 * OpenAI API (which expects unprefixed model IDs).
 */
const EMBEDDING_MODEL = 'openai/text-embedding-3-small';

/** Expected output dimensionality of the model above. */
export const EMBEDDING_DIMENSIONS = 1536;

let cachedClient: OpenAI | null = null;

/**
 * Lazily build the OpenAI client from environment secrets. Throws a
 * caller-friendly error if `OPENAI_API_KEY` is missing.
 */
function getClient(): OpenAI {
  if (cachedClient) return cachedClient;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY is not configured. Set it in the Secrets tab before ingesting a repository.',
    );
  }

  const baseURL = process.env.OPENAI_BASE_URL?.trim() || undefined;

  cachedClient = new OpenAI({
    apiKey,
    baseURL,
  });
  return cachedClient;
}

/**
 * Some providers expect `openai/text-embedding-3-small`, others expect
 * `text-embedding-3-small`. We default to the OpenRouter-friendly
 * prefixed form and strip the prefix when the base URL is bare OpenAI.
 */
function getEffectiveModelId(): string {
  const baseURL = (process.env.OPENAI_BASE_URL || '').toLowerCase();
  const isBareOpenAI = baseURL === '' || baseURL.includes('api.openai.com');
  if (isBareOpenAI && EMBEDDING_MODEL.startsWith('openai/')) {
    return EMBEDDING_MODEL.slice('openai/'.length);
  }
  return EMBEDDING_MODEL;
}

/** Sleep helper for back-off. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** True when the error is a 429 (rate limit) from the OpenAI SDK. */
function isRateLimited(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { status?: number; code?: string };
  return e.status === 429 || e.code === 'rate_limit_exceeded';
}

/**
 * Embed a batch of texts in a single API call. OpenAI's embeddings
 * endpoint (and OpenRouter's compatible mirror) accept arrays of inputs
 * and return one vector per input in the same order.
 *
 * Returns an array of the same length as `texts`. Slots that failed to
 * embed (after retry) are returned as `null`, so the caller can skip
 * them when persisting and not crash the whole pipeline.
 *
 * Resilience:
 *   - On a 429 (rate limit), we sleep ~2s and retry the batch once. If it
 *     still fails, every slot in this batch returns `null`.
 *   - On any other error, we log via `console.error` and return `null`s.
 *     The caller may choose to retry per-chunk if desired; for the MVP
 *     we just skip and continue.
 *
 * Empty inputs are filtered out client-side (the API rejects empty
 * strings); their slots return `null`.
 */
export async function embedTexts(
  texts: string[],
): Promise<Array<number[] | null>> {
  if (texts.length === 0) return [];

  // Filter out empty strings up front — the API rejects them, and an
  // empty chunk has no semantic content to embed anyway.
  const indexed: Array<{ original: number; text: string }> = [];
  texts.forEach((t, i) => {
    if (t && t.trim().length > 0) indexed.push({ original: i, text: t });
  });

  const out: Array<number[] | null> = new Array(texts.length).fill(null);
  if (indexed.length === 0) return out;

  const client = getClient();
  const model = getEffectiveModelId();

  // Single batched request first. If it works, we're done.
  try {
    const res = await client.embeddings.create({
      model,
      input: indexed.map((x) => x.text),
    });
    res.data.forEach((d, i) => {
      out[indexed[i].original] = d.embedding;
    });
    return out;
  } catch (err) {
    if (isRateLimited(err)) {
      console.warn(
        `[embedTexts] rate-limited on batch of ${indexed.length}; backing off 2s and retrying once`,
      );
      await sleep(2000);
      try {
        const res = await client.embeddings.create({
          model,
          input: indexed.map((x) => x.text),
        });
        res.data.forEach((d, i) => {
          out[indexed[i].original] = d.embedding;
        });
        return out;
      } catch (retryErr) {
        console.error('[embedTexts] retry after rate-limit also failed:', retryErr);
        return out; // all nulls — pipeline keeps going
      }
    }

    console.error('[embedTexts] embedding request failed:', err);
    return out; // all nulls — pipeline keeps going
  }
}
