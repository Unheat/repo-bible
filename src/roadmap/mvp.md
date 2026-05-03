---
name: MVP
type: roadmap
status: done
description: The first shippable version — paste-a-URL ingestion, AI-generated architecture overview plus per-file deep-dives, browseable dashboard, and one-click PR back to the source repo.
requires: []
effort: large
---

The MVP is the smallest end-to-end version of Codebase Bible that proves the core idea: turn any GitHub repository into a navigable technical bible in a few minutes, with no setup beyond pasting a URL.

It covers the full pipeline. A user lands on the home page, drops a GitHub URL, and the system fetches the file tree, filters out boilerplate, persists the surviving files, and embeds every chunk of every file. As soon as ingestion completes the AI pipeline kicks in automatically: a Mapper agent produces a repository-level architecture summary with a Mermaid flowchart, then a Deep-Dive agent runs concurrently over every file producing a senior-engineer-grade markdown writeup. The result lands in a dashboard with a sidebar of files and a markdown reader, and can be opened as a pull request on the source repository in one click.

The visual identity ships in the same release: a dark IDE aesthetic with sharp 1px borders, monospace chrome, and a single mint accent. The voice is terse and technical, matching the audience.

~~~
Architecture: hybrid AI routing. Embeddings via the OpenAI Node SDK pointed at OpenRouter (the MindStudio SDK has no embedding action today). Text generation via the native `mindstudio.generateText` action with `claude-4-6-sonnet`. The Mapper uses adaptive thinking; the Deep-Dive does not. Both prompts enforce strict close-world constraints to keep hallucination low.

Backend: 4 tables (`repositories`, `files`, `code_chunks`, `generated_docs`), 5 methods (`ingestRepository`, `generateBible`, `listRepositories`, `getRepositoryDetail`, `openDocumentationPR`). Both `ingestRepository` and `generateBible` use the fire-and-forget background-task pattern with a status column on the row.

Frontend: Vite + React 19 + wouter, two routes (home, dashboard), polling-based live status, a self-contained markdown component with Mermaid and highlight.js support.

Secrets configured in dev and prod: `OPENAI_API_KEY`, `OPENAI_BASE_URL` (OpenRouter), `GITHUB_TOKEN`.

Out of Scope (tracked as separate roadmap items): stale file pruning, parallel ingestion, concurrent-run guard on `generateBible`, fork-and-PR, retrieval-augmented Deep-Dive, auth, scenarios, deep-link routing, mobile responsive, download-as-HTML.
~~~

## History

- **2026-05-03** — Initial production release. Commit `5b07184`. Smoke tested against `sindresorhus/is-plain-obj` (12 files, full bible in ~80s) and `expressjs/express` (208 files, ingestion in ~2.5 min). Public app live at `aa558216-a9cf-4f0c-a22b-8e2c9bfd938a.msagent.ai`. Source mirrored to `github.com/Unheat/repo-bible`.
