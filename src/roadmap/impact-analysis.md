---
name: Impact Analysis
type: roadmap
status: planned
description: Select any file and see every other file that depends on it — a ripple map of change risk across the codebase.
requires: ["codebase-chat.md"]
effort: large
---

The most dangerous thing about changing code in an unfamiliar codebase is not knowing what you'll break. Senior engineers build this map in their heads over months. Impact Analysis makes it available on day one.

Select any file in the sidebar. A new "Impact" tab appears in the reader next to the writeup. It shows a ranked list of every file that imports from, calls into, or semantically depends on the selected file — sorted by coupling strength. For each dependent file, a short note explains the nature of the dependency. The Mermaid diagram shows the ripple visually.

## What it looks like

The reader panel gains a two-tab interface: "Writeup" (the existing deep-dive) and "Impact" (the new view). The Impact tab renders:

- **Direct dependents** (files that import this file) listed first. Identified by static import analysis.
- **Likely dependents** (files that call functions or use types from this file, identified by semantic similarity) listed second, with a confidence indicator.
- **A Mermaid impact graph** showing the selected file at the center, dependents radiating out, colored by coupling strength (direct = mint, semantic = muted).
- A plain-language summary at the top: "3 files directly import this. 8 files show strong semantic coupling. Changing the public interface of this file carries high change risk."

## Key details

- **Static analysis:** at ingest time, parse each file's import statements and store a `file_imports` table: `(fileId, importedPath)`. The imported path is resolved relative to the repo root. This gives a precise direct-dependency graph.
- **Semantic analysis:** at bible-generation time (or on demand), compute cosine similarity between the selected file's chunks and all other files' chunks. Files with similarity above a threshold (e.g., 0.75) are flagged as semantically coupled.
- **Change risk score:** `directImporters * 3 + semanticallyCoupled * 1`. Displayed as "low / medium / high" in the sidebar's file list (a small colored dot next to each file).
- **The ripple map as a whole-repo view:** a separate top-level "Impact Map" button in the toolbar renders a full-repo Mermaid graph showing all import relationships. Large repos truncate to the top 50 most-connected files.

~~~
New table: `FileImports`. Columns: `fromFileId`, `toFilePath` (not yet resolved to a fileId — some imports may reference node_modules or files that were filtered). Populated during ingestion by parsing each file's import statements with a simple regex (for JS/TS: `import ... from '...'`, `require('...')`; for Python: `import ...`, `from ... import ...`).

New method: `getFileImpact({ fileId, repositoryId })`. Returns `{ directDependents: File[], semanticDependents: { file: File, score: number }[], riskScore: number, mermaidGraph: string }`. The Mermaid graph is generated server-side from the dependency data.

The risk score dot in the sidebar is computed once when the bible is first generated and stored as a column on the `files` table (`riskScore: 'low' | 'medium' | 'high' | null`). It renders as a 4px dot to the right of the file path in the sidebar.
~~~
