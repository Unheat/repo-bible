---
name: Codebase Bible
description: A RAG-based engine that ingests GitHub repositories, analyzes them with AI agents, and produces an interactive onboarding guide for new developers.
---

# Codebase Bible

An AI-powered documentation engine for GitHub repositories. The user points the app at a GitHub URL. The app clones the repo, parses each source file into an Abstract Syntax Tree, breaks the code into semantically meaningful chunks (functions, classes, boilerplate), embeds those chunks for retrieval, and runs two AI agents over the result: a [Mapper]{High-level agent. Surveys the entire repo, identifies entry points, module boundaries, and cross-file relationships. Output is structural — what talks to what.} that produces a structural overview, and a [Deep-Dive]{Per-file or per-module agent. Reads chunks plus retrieved context from the rest of the repo to explain how a given piece works in detail.} that produces detailed per-file documentation. The end product is an interactive Codebase Bible: navigable markdown documentation with embedded flowcharts, designed to onboard new developers quickly.

~~~
Build proceeds strictly step-by-step under user direction. This file currently covers Step 1 (data model) only. Methods, agent orchestration, ingestion pipeline, and interface specs are deliberately out of scope until subsequent steps are unlocked by the user.

Platform reality check, surfaced once at the top so it is not re-litigated downstream:
- The platform's database is managed SQLite, not PostgreSQL. The schema below is modeled relationally — every parent-child link is expressed as an ID column on the child — but enforcement of foreign keys and cascading deletes happens in application code (the methods that perform deletes), not via SQL constraints. This is the platform contract; it does not change the logical data model.
- Vector similarity search is not a native database operation. Embeddings are stored as a JSON array of numbers on the chunk row. Initial implementation will compute cosine similarity in-process at query time. If/when scale forces a change, embeddings can be offloaded to an external vector store (Pinecone, Turbopuffer, etc.) with the SQLite row holding only the external vector ID. The interface column shape stays the same either way.
- All four tables get auto-managed system columns (`id` UUID, `created_at`, `updated_at`, `last_updated_by`). They are not redeclared in the interfaces below.
~~~

## Data Model

The data model is strictly relational with four tables: `repositories`, `files`, `code_chunks`, and `generated_docs`. Each child row references its parent by ID, and deleting a parent must cascade to all of its descendants.

~~~
Cascading delete chain (enforced in application code via `removeAll` predicates inside `db.batch(...)`):

  delete repository
    → delete all files where file.repo_id = repository.id
      → delete all code_chunks where chunk.file_id IN (those file ids)
      → delete all generated_docs where doc.file_id IN (those file ids)

A shared helper (e.g. `dist/methods/src/common/cascadeDeleteRepository.ts`) should own this so any method that removes a repo, or re-ingests one, calls a single function. Same shape applies for cascading delete of a single file.

All cross-table reads in methods batch via `db.batch(...)` — there are no JOINs.
~~~

### Repositories
Top-level entity. One row per GitHub repository the user has added to the system.

~~~
Table name: `repositories`. Columns:
- `githubUrl` (string) — full HTTPS URL to the repo, e.g. `https://github.com/owner/name`. Logical unique key.
- `repoName` (string) — display name, typically derived from the URL (`owner/name`). Stored separately so the UI doesn't re-parse on every render.
- `lastScannedAt` (number, unix ms, optional) — timestamp of the most recent successful ingestion run. `undefined` until the first scan completes; updated on every successful re-scan. Distinct from the auto-managed `updated_at` column, which moves on any write.

Unique constraint: `[['githubUrl']]`. Required so re-ingestion can `upsert` on URL instead of duplicating rows.

No status column in this step. Ingestion lifecycle (queued/scanning/ready/failed) is a Step 2+ concern and will be added when the ingestion pipeline is specified.
~~~

### Files
One row per source file discovered inside a repository during ingestion. Owned by exactly one repository.

~~~
Table name: `files`. Columns:
- `repoId` (string, FK → `repositories.id`) — owning repository. Required.
- `filePath` (string) — path relative to the repo root, e.g. `src/lib/auth.ts`. Stored with forward slashes regardless of source OS.
- `language` (string) — detected language label (e.g. `typescript`, `python`, `go`, `markdown`, `unknown`). Free-form string in this step; a controlled vocabulary can be introduced later if needed.

The TypeScript interface for this table is named `RepoFile` (not `File`) to avoid colliding with the global DOM `File` type. The exported table object is still `Files`.

Unique constraint: `[['repoId', 'filePath']]` — a given path appears at most once per repo. Allows re-ingestion to upsert rather than duplicate.

Cascading delete: when a repository is removed, all files with matching `repoId` are removed in the same batch.
~~~

### Code Chunks
Semantic units extracted from a file by the AST parser. A single file produces many chunks. Each chunk carries its text, a coarse type label, and an embedding vector for retrieval.

~~~
Table name: `code_chunks`. Columns:
- `fileId` (string, FK → `files.id`) — owning file. Required.
- `chunkText` (string) — the exact source text of the chunk, preserved verbatim (whitespace and all) so retrieval results can be shown to the user as-is.
- `chunkType` (string) — coarse category produced by the AST parser. Initial vocabulary: `function`, `class`, `method`, `interface`, `type`, `import`, `boilerplate`, `comment`, `other`. Free-form string at the column level; the parser is responsible for staying within the agreed set. Widening or narrowing the set later is a code change, not a schema change.
- `embedding` (number[], JSON-serialized) — embedding vector for semantic search. Stored as a JSON array of floats. Length is whatever the chosen embedding model produces (e.g. 1536 for OpenAI `text-embedding-3-small`); the column is not length-constrained at the schema level so the embedding model can be swapped without a migration.

No unique constraint. A file can produce many chunks, and identical chunk text can legitimately recur (boilerplate, repeated imports). De-duplication, if desired, is a pipeline concern, not a schema constraint.

Cascading delete: when a file is removed (directly, or transitively via its repository), all chunks with matching `fileId` are removed in the same batch.

Embedding-search note: the initial query path loads candidate chunks via SQL filters (e.g. by `repoId` joined through `files`) and computes cosine similarity in the method process. Acceptable up to roughly ten-thousand chunks per query scope; above that, plan to migrate to an external vector index. The column shape does not change in either world.
~~~

### Generated Docs
Markdown documentation produced by the AI agents for a given file. Multiple rows per file are allowed and intentional, so the history of generated docs is preserved across re-runs.

~~~
Table name: `generated_docs`. Columns:
- `fileId` (string, FK → `files.id`) — file the doc describes. Required.
- `markdownContent` (string) — the full markdown body produced by the Deep-Dive agent (or, in some flows, the Mapper). May embed Mermaid flowchart blocks; rendering is a frontend concern. Stored as-is.

Deliberately NOT declared on this table: a `createdAt` column. The platform provides a system `created_at` (unix ms) on every row, which is what the UI reads for "generated on …" values and what queries sort by. Adding a separate `createdAt` would create a confusing duplicate. The user-facing data contract for creation timestamp is satisfied by `doc.created_at`.

No unique constraint. Multiple generations per file are valid — re-running the agents must not destroy previous output. "Latest doc for a file" is a query (`sortBy(d => d.created_at).reverse().take(1)`), not a uniqueness rule.

Cascading delete: when a file is removed, all generated_docs with matching `fileId` are removed in the same batch.
~~~

## Ingestion

Ingestion is the process of pointing the app at a GitHub repository and turning it into rows in our database that downstream agents can read. Step 2 covers the structural ingestion: fetch the file list, filter the noise, and persist `repositories` + `files`. Chunking and embedding (the `code_chunks` table) is wired in via a placeholder and is implemented in Step 3.

### `ingestRepository` Method

The single public method for Step 2. The user provides a GitHub URL; the method returns a summary of what was ingested.

~~~
Manifest entry:
  id: `ingest-repository`
  path: `dist/methods/src/ingestRepository.ts`
  export: `ingestRepository`

Input:
  `{ githubUrl: string }`

Output:
  `{ repositoryId, repoName, defaultBranch, fileCount, filteredCount, truncated }`

The method runs unauthenticated for the MVP. Auth, rate limiting, and per-user repository ownership are deliberately deferred.
~~~

The pipeline runs the following steps in order. Any step that fails surfaces a friendly error to the caller; the underlying details are written to `console.error` for debugging.

1. **Parse the URL.** Accept `https://github.com/owner/name`, the same with `.git` suffix or trailing path (e.g. `/tree/main`), and `git@github.com:owner/name(.git)`. Canonicalize to `https://github.com/{owner}/{name}` so re-ingestion of variants of the same URL collapses onto one row.
2. **Fetch repository metadata** from `GET /repos/{owner}/{name}` to learn the [default branch]{The branch name (e.g. `main`, `master`, `trunk`) the repo serves as its tip. We always ingest the default branch in Step 2; arbitrary-branch ingestion is a later step.}.
3. **Fetch the recursive file tree** from `GET /repos/{owner}/{name}/git/trees/{branch}?recursive=1`. Surface the response's `truncated` flag back to the caller; we do not paginate the tree in this step.
4. **Filter** the tree to text-only blobs worth indexing (see "Filtering Rules" below).
5. **Upsert the `repositories` row** keyed on `githubUrl`. Sets `repoName` to `owner/name` and `lastScannedAt` to the current unix-ms timestamp.
6. **Upsert each surviving file row** into `files`, keyed on `(repoId, filePath)`. Re-ingestion updates rows in place rather than creating duplicates, which keeps file IDs stable across runs (important once Step 3 starts attaching chunks to those IDs).
7. **Invoke `chunkAndEmbedFile(fileId, rawContent)`** once per persisted file. In Step 2 this is a placeholder that just logs; Step 3 replaces its body with real chunking + embedding logic.

~~~
GitHub REST API client lives in `dist/methods/src/common/githubClient.ts`. Uses native global `fetch` (Node 18+ runtime).

Authentication is optional. If the secret `GITHUB_TOKEN` is set in `process.env`, it is sent as a Bearer token. Without it, requests are unauthenticated and subject to GitHub's 60-requests-per-hour-per-IP limit. For testing against small public repos this is fine; for any real use the token should be configured.

GitHub-specific status codes get user-friendly error mapping:
  - 404 → "Repository not found. Make sure the URL is correct and the repository is public (or that GITHUB_TOKEN is configured for private access)."
  - 403 / 429 → "GitHub API rate limit reached. Configure a GITHUB_TOKEN secret to raise the limit, then try again."
  - other non-2xx → "GitHub API request failed (status). Check the logs for details." with the raw response body in `console.error`.

Required headers on every request: `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2022-11-28`, `User-Agent: codebase-bible-ingestor`.
~~~

### Filtering Rules

Not every file in a repo is worth indexing. The filter has four layers, applied in order; the first that matches discards the file.

~~~
Filter implementation lives in `dist/methods/src/common/fileFilters.ts`. All sets are exported as `const` at the top of the file so the rule set is easy to audit and amend without rummaging through logic.

1. Boilerplate directory segments. If any segment of the path matches one of these, the file is dropped. Initial set:
   `node_modules`, `.git`, `.github`, `.svn`, `.hg`, `dist`, `build`, `out`,
   `.next`, `.nuxt`, `.svelte-kit`, `.astro`, `.expo`, `.output`, `target`,
   `vendor`, `__pycache__`, `.venv`, `venv`, `.idea`, `.vscode`, `.vs`,
   `coverage`, `.nyc_output`, `.cache`, `.parcel-cache`, `.turbo`,
   `.vercel`, `.pnpm-store`, `bower_components`, `jspm_packages`, `Pods`,
   `DerivedData`.
2. Skip-by-filename (exact match on the basename). Lockfiles and OS metadata:
   `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `npm-shrinkwrap.json`,
   `Cargo.lock`, `Gemfile.lock`, `poetry.lock`, `composer.lock`,
   `Pipfile.lock`, `Podfile.lock`, `mix.lock`, `.DS_Store`, `Thumbs.db`.
3. Skip-by-pattern: minified bundles (`*.min.js|css|html|mjs|cjs`) and sourcemaps (`*.map`).
4. Skip-by-extension. Binary or non-textual extensions: image (png, jpg, jpeg, gif, webp, ico, bmp, tif, tiff, svg), document (pdf, doc(x), ppt(x), xls(x)), archive (zip, tar, gz, bz2, xz, 7z, rar), audio/video (mp4, mp3, wav, ogg, mov, avi, webm, flac, aac, m4a), font (woff, woff2, ttf, otf, eot), compiled (exe, dll, so, dylib, a, o, obj, class, jar, war, ear, wasm, pyc, pyo, pyd), data (sqlite, sqlite3, db, dat, bin).
5. Size cap: files larger than 1 MB are skipped (the GitHub tree response carries `size` in bytes per blob).

Only tree nodes with `type === 'blob'` are considered — directories and submodule pointers are ignored before this filter even runs.
~~~

### Language Detection

Each surviving file is tagged with a `language` label, derived purely from its filename. No content sniffing; this is a hackathon MVP and extension-based detection is sufficient.

~~~
Language detection lives alongside the filter in `fileFilters.ts` as `detectLanguage(path)`.

Special-cased filenames (no extension): `Dockerfile` and `Dockerfile.*` → `dockerfile`; `Makefile`, `GNUmakefile` → `makefile`; `Rakefile`, `Gemfile`, `Podfile` → `ruby`.

Otherwise mapped by extension. Initial mapping covers the common languages a developer onboarding to a typical repo would encounter: typescript, javascript, python, ruby, go, rust, java, kotlin, swift, objective-c/cpp, c, cpp, csharp, fsharp, php, scala, clojure, elixir, erlang, elm, haskell, ocaml, dart, lua, r, perl, shell, powershell, sql, graphql, protobuf, vue, svelte, astro, html, css/scss/sass/less/stylus, markdown/mdx/restructuredtext/text, json/yaml/toml/ini/xml/csv.

Unmapped extensions → `language: 'unknown'`. This is a deliberate fall-through, not an error condition; downstream agents can still read `chunkText` and reason about the file.
~~~

### `chunkAndEmbedFile` Placeholder

The call site for the chunking + embedding pipeline is wired in Step 2 with its final signature so Step 3 only needs to fill in the body.

~~~
Location: `dist/methods/src/common/chunkAndEmbedFile.ts`.

Signature: `chunkAndEmbedFile(fileId: string, rawContent: string): Promise<{ chunkCount: number }>`.

Step 2 behavior: log that it was called (including the fileId and the length of `rawContent`) and return `{ chunkCount: 0 }`. No DB writes.

Step 3 (deferred) will:
  1. Parse `rawContent` into an AST appropriate for the file's language.
  2. Walk the AST to produce semantic chunks (function, class, method, interface, type, import, boilerplate, comment, other).
  3. Generate an embedding for each chunk via the MindStudio SDK.
  4. Persist chunks into `code_chunks` with `fileId` set.

Note on the call site: `ingestRepository` currently passes an empty string for `rawContent` because Step 2 has no need to fetch raw file bytes. Step 3 will either (a) fetch raw content inside `ingestRepository` before calling `chunkAndEmbedFile`, or (b) push the fetch responsibility into `chunkAndEmbedFile` itself. That decision is part of Step 3.
~~~

### Re-ingestion Semantics

Ingesting the same `githubUrl` twice is supported and idempotent at the row level:

- `repositories` upserts on `githubUrl`, so the row's `id` is stable across runs. `lastScannedAt` is overwritten with the new timestamp.
- `files` upserts on `(repoId, filePath)`, so file IDs are stable for paths that still exist in the repo. The `language` label is recomputed in case the extension mapping has been updated.

What re-ingestion does **not** do in Step 2:

- It does not delete `files` rows whose paths have been removed from the repo since the last scan. Stale rows linger. A "prune deleted files (and cascade-delete their chunks/docs)" pass is deferred to a later step — the cascading-delete chain documented earlier in this spec is what that pass will use.
- It does not detect renames. A renamed file appears as a new `files` row with the new path; the old path remains as a stale row.

~~~
Step 3 prerequisite (flagged for early visibility, not implemented in Step 2):

Once `chunkAndEmbedFile` does real work, the per-file cost dominates ingestion time. Hundreds of files × (raw-content fetch + AST parse + per-chunk embedding) will exceed any reasonable method timeout. Step 3 will need to:
  - Add a `status` column to `repositories` (e.g. `idle | scanning | ready | failed`).
  - Convert `ingestRepository` to a fire-and-forget shape: persist the repo + file rows synchronously, return immediately with `repositoryId` and `status: 'scanning'`, and run the chunking + embedding loop in a background promise that updates `status` on completion or failure.

The shape is documented in the platform's "Fire-and-Forget Background Tasks" pattern.
~~~

## Out of Scope (Tracked for Later Steps)

- Step 3: real chunking + embedding inside `chunkAndEmbedFile`, fire-and-forget ingestion shape, `repositories.status` column.
- Mapper and Deep-Dive agent prompts, models, and orchestration.
- Pruning of stale `files` rows on re-ingestion (and the cascading-delete pass that comes with it).
- Web interface, navigation, flowchart rendering.
- Auth, multi-user concerns, per-repository ownership.
- Scenarios and seed data.
