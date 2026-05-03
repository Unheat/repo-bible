---
name: Parallel Ingestion
type: roadmap
status: planned
description: Cut large-repo ingestion time by ~8x by fetching and embedding files concurrently instead of one at a time.
requires: []
effort: small
---

The expressjs/express smoke test took 2.5 minutes for 208 files because every file is fetched, chunked, and embedded serially. A concurrency pool identical to the one already running in the Deep-Dive loop brings that to roughly 20 seconds. The infrastructure is already proven; this is applying it to Phase 1.

## What it looks like

The user experience is the same dashboard — but the "Ingesting…" spinner resolves in seconds instead of minutes for any repo over a few dozen files. The progress indicator can show files-processed / total-files during the run.

## Key details

- Target concurrency: 8 workers, matching the Deep-Dive pool.
- Each worker fetches raw file content, runs chunk + embed, and inserts rows.
- Partial failures (embed returns null for a chunk) continue to be tolerated — the pool catches per-file errors and logs them without aborting the rest.
- `lastScannedAt` is only written after the full pool drains successfully.
- No UI changes required beyond the progress counter; the polling dashboard already handles the `processing` → `completed` transition.

~~~
Apply the same promise-pool pattern from `generateBible`'s Deep-Dive loop. The pool lives in `ingestRepository.ts`. Pull the per-file fetch + chunk + embed block into a `processFile(file)` helper, then feed the filtered file list into a pool of 8 concurrent workers.

Rate limiting: the GitHub raw-content API is unauthenticated at up to 60 req/min without a token, 5000 with one. At concurrency 8 the unauthenticated case should stay under the limit for repos under ~400 files; for larger repos the existing GITHUB_TOKEN secret already raises the ceiling.
~~~
