---
name: Cross-File Deep-Dives
type: roadmap
status: planned
description: Each file's writeup now draws on relevant context from across the entire codebase, not just its own source code.
requires: ["parallel-ingestion.md"]
effort: medium
---

The Deep-Dive agent currently works from two inputs: the full source of the file being analyzed, and the architecture overview. That's good. But a real senior engineer reading a file also reads the files it imports — they don't have to infer what `UserService` does, they go look at it. The embeddings for every chunk of every file are already stored. This feature uses them.

Before analyzing each file, the pipeline retrieves the most semantically relevant chunks from other files in the repo — the actual implementations of the things this file depends on — and passes them as grounded context to the Deep-Dive agent. Writeups stop saying "this likely delegates to an external service" and start saying "this calls `UserService.findById`, which is implemented in `src/services/user.ts` and does X."

## What it looks like

The generated writeups become visibly more precise. Cross-file references are specific, not hedged. The "Dependencies and Integrations" section names the actual functions and describes their actual behavior. The "Internal Logic Walkthrough" traces calls across file boundaries instead of stopping at import statements.

No UI change. The improvement is in the quality of the output.

## Key details

- **Retrieval step:** before running the Deep-Dive on a file, embed the file's source (or a summary of its imports and call sites) and run a cosine similarity search against the `code_chunks` table. Retrieve the top-10 most relevant chunks from other files.
- **Context window management:** the retrieved chunks are injected into the Deep-Dive prompt after the architecture summary and before the file source. If the total context would exceed the model's limit, prefer chunks from directly imported files over general semantic matches.
- **Close-world constraint stays:** the Deep-Dive prompt's close-world rule is updated to cover both the primary file source and the retrieved chunks — the model may reference anything in either set, and nothing else.
- **Import-graph prioritization:** statically parse the file's import statements to identify direct dependencies. Retrieve chunks from those files first, regardless of semantic similarity score.

~~~
Retrieval implementation: add a `retrieveRelevantChunks(fileId, repoId, topK)` utility in `dist/methods/src/common/retrieval.ts`. It embeds the query (the file's source or a condensed query string), then loads all chunks for the repo from the `code_chunks` table (excluding the queried file's own chunks), computes cosine similarity in-process, and returns the top-K results.

In-process cosine similarity: for a repo of 200 files with average 3 chunks each, that's ~600 vectors of 1536 dimensions. A naive dot product loop is fast enough in JS for this scale. No external vector DB needed.

Prompt update: add a "RELEVANT CONTEXT FROM OTHER FILES" section in the Deep-Dive system prompt. Each chunk is formatted as a fenced code block with the source file path as the header. The model is instructed to cite the source path when referencing this context.
~~~
