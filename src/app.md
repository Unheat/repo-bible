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

## Out of Scope for Step 1

Deliberately not specified yet, to be addressed in subsequent steps under user direction:

- Ingestion pipeline (cloning, AST parsing, chunking strategy, embedding generation)
- Mapper and Deep-Dive agent prompts, models, and orchestration
- Methods (no `dist/methods/src/*.ts` work in this step)
- Web interface, navigation, flowchart rendering
- Auth, multi-user concerns, rate limiting
- Scenarios and seed data
