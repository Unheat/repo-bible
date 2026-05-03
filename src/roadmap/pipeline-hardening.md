---
name: Pipeline Hardening
type: roadmap
status: planned
description: Guard against duplicate bible runs and clean up stale file rows when a repo is re-ingested after upstream deletions.
requires: []
effort: small
---

Two known data-integrity gaps live in the pipeline today. Neither surfaces in normal use but both become visible as soon as the app sees real traffic or a user clicks Regenerate more than once before the first run finishes.

## What it looks like

Users never see these directly — this is correctness work. The surface change is that Regenerate becomes safe to click at any time: if a run is already in progress, the button is a no-op (or surfaces a clear "already running" state) rather than starting a second parallel pipeline.

## Key details

**Concurrent-run guard on `generateBible`:**
- Before flipping `docsStatus` to `generating`, check the current value in the same transaction.
- If `docsStatus` is already `generating`, return a structured error (or a no-op response) rather than starting a second run.
- This is a server-side guard. The UI already disables the button during generation but direct API invocations bypass that.

**Stale file pruning on re-ingest:**
- When `ingestRepository` runs against a repo that already has a `files` row set, compute the diff between the new file tree and the stored rows.
- Delete file rows (and their associated chunks and docs) for paths that no longer exist upstream.
- The upsert for surviving files is already idempotent; this just adds the deletion step for orphans.

~~~
Guard implementation: wrap the `docsStatus` read-and-flip in a conditional update. In SQLite this is a single `UPDATE ... WHERE docsStatus != 'generating'` followed by checking `changes`. If `changes === 0`, the guard fired — return early.

Stale pruning: after the new file tree is fetched and filtered, collect the set of surviving paths. Query the existing file rows for this repo. Compute `orphanedIds = existingRows.filter(r => !newPaths.has(r.filePath))`. Delete from `code_chunks` where `fileId IN (orphanedIds)`, then from `generated_docs` where `fileId IN (orphanedIds)`, then from `files` where `id IN (orphanedIds)`. All three deletes before inserting new rows.
~~~
