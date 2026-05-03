---
name: Ask the Codebase
type: roadmap
status: planned
description: A conversational interface that answers questions about the repo, grounded in the generated bible and the embedded source code.
requires: ["rag-deepdive.md"]
effort: large
---

Every engineer who reads a bible has follow-up questions. "What handles authentication?" "Where does this event get emitted?" "If I change this interface, what else breaks?" Right now the answer is: keep reading. The next step is: ask.

The codebase is already indexed — every chunk of every file is embedded and stored. Ask the Codebase puts a conversational interface on top of that index. Questions are answered with exact file references, code quotes, and grounded reasoning. Not a search engine. Not a chatbot that makes things up. An engineer who has actually read the code.

## What it looks like

A chat panel opens from the bottom of the dashboard when the user clicks "Ask →" in the toolbar (or presses `/`). The panel is a floating, resizable overlay on the reader — it doesn't replace it, it sits alongside it so the user can read the writeup and ask questions at the same time.

The input is a single text field with a "⌘Enter to send" hint. Responses stream in. Each response includes:

- The direct answer in plain prose.
- One or more "cited from" file chips below the response — the exact files the answer was grounded in. Clicking a chip navigates the reader to that file.
- If a code excerpt was directly quoted, it renders as a fenced code block with syntax highlighting and the source path in the header.

The chat maintains context across turns in the session. "Which file does X?" followed by "What does it import?" works as expected.

## Key details

- **Retrieval:** the user's question is embedded and used to retrieve the top-10 most relevant chunks from the repo's `code_chunks` table. The top-3 matching generated docs (full writeups) are also retrieved.
- **Prompt construction:** system prompt + architecture overview + retrieved chunks + retrieved writeup excerpts + conversation history + user question. The model is instructed to cite every claim with a file path and to use the close-world constraint (reference nothing that isn't in the provided context).
- **Streaming:** responses stream token by token from the backend. The frontend renders the stream as it arrives.
- **Conversation history:** stored in client state only (no DB persistence for the MVP of this feature). Cleared when the panel closes or the repo changes.
- **Scope guard:** the model is instructed to decline questions that cannot be answered from the codebase context ("I don't see evidence of that in this codebase").

~~~
New method: `askCodebase({ repositoryId, messages: { role, content }[] })`. Uses `mindstudio.generateText` with streaming enabled. Retrieval: same `retrieveRelevantChunks` utility from the RAG Deep-Dive item. Also fetch the top-3 matching generated docs using embedding similarity on `markdownContent`.

Frontend: the chat panel is a CSS-positioned overlay panel, not a route. It has its own scroll container. The streaming response renders incrementally using the same MarkdownView component in a streaming mode (append new tokens to a growing string, re-render on each chunk).

File chips: parse the model's response for file path citations (e.g., `src/foo/bar.ts` patterns). Render each unique cited path as a clickable pill that fires the sidebar navigation to that file.
~~~
