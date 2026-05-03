---
name: Voice & Terminology
description: Terse, technical, code-comment register. No marketing fluff, no emojis, no em dashes. The product talks like a senior engineer leaving useful comments in a pull request.
---

# Voice & Terminology

The voice across every surface — UI copy, error messages, generated documentation, toolbar labels — is the same register: terse, technical, factual. The product does not cheer the user on, and it does not apologize. It reports what is happening, what failed, and what to do next, the way a senior engineer would in a pull request review.

## Tone characteristics

- **Direct.** "Ingestion failed" beats "Oh no, something went wrong while we were ingesting your repo." If something failed, say so in three words.
- **Specific.** "12 files ingested · 12 documented · architecture ready" beats "Your repo is ready!" — the user wants the count.
- **Lowercase technical, sentence-case readable.** Status pills are uppercase tracked monospace ("INGEST COMPLETED"), prose is sentence case ("Ingestion failed"), code paths are exact verbatim. Do not invent capitalization rules per section.
- **Code-comment register for hints.** "Public repos work without configuration. Private repos and PR creation require a GITHUB_TOKEN secret." reads like a comment, not a marketing line. Keep it that way.

## Forbidden constructs

These never appear in app copy or in generated documentation:

- **Emojis.** Anywhere. Not in toasts, not in error messages, not in markdown output. The Mapper and Deep-Dive prompts both explicitly forbid them.
- **Em dashes.** Use periods, commas, parentheses, or colons instead. Em dashes are the most reliable AI-output tell, and the product is partly an AI product, so we work harder than usual to avoid them.
- **Marketing intensifiers.** "Powerful", "blazing-fast", "delightful", "magical", "amazing", "world-class" — none of these appear. If a feature is fast, the visible latency proves it; we do not need to describe it.
- **Self-congratulatory hedging from the model.** "Here is the analysis:", "I hope this helps", "Let me know if you need more detail." Both AI prompts strip these.
- **Vague filler errors.** "Something went wrong" is forbidden. Every error message includes the operation that failed and, where possible, the underlying cause.

## Terminology

Use these exact terms consistently.

| Concept | Term to use | Don't use |
|---|---|---|
| The unit of work | Bible (proper noun, capitalized) | "documentation set", "doc bundle" |
| The repo-level summary | Architecture overview | "high-level docs", "repo summary" |
| The per-file writeup | Deep-Dive | "file analysis", "per-file doc" |
| The two AI agents | Mapper and Deep-Dive | "the AI", "the model" |
| The act of starting ingestion | Ingest | "scan", "import", "process" |
| The act of running the AI agents | Generate (a Bible) | "analyze", "build docs" |
| The PR feature | Push to GitHub | "Export", "Send to GitHub", "Sync" |
| The future no-auth alternative | Download as HTML | "Export to HTML", "Save HTML" |
| Repository identifier | repo name (`owner/name`) | "project", "codebase" in chrome |

The product is "Codebase Bible" — two words, both capitalized when used as the product name. "the Bible" (capitalized) refers to a generated output. "a bible" (lowercase) is acceptable when referring generally to the output type.

## UI copy patterns

**Status pills.** `INGEST {STATUS}` and `DOCS {STATUS}`. The status word is one of `idle`, `processing`, `generating`, `completed`, `failed`. No verbose phrasings.

**Empty states.** State the situation, then point to the action. "No repositories yet. Drop a URL in the box above to start." Not "You haven't added any repos yet — get started by adding one above!"

**Loading status pages.** Title in title case, subtitle in sentence case. Title states what is happening: "Ingesting expressjs/express…". Subtitle gives a useful detail and a rough expectation: "Fetching file tree, chunking source, generating embeddings. Usually under a minute for small repos, a few minutes for large ones."

**Toasts.** One-line title, optional supporting line. Success: "Pull request #42 opened." with the URL beneath. Error: the literal error message, no decoration.

**Buttons.** Verb + object. "Generate Bible →", "Push to GitHub →", "Regenerate", "Retry". The arrow on primary actions reinforces forward motion. Ghost-style secondary actions skip the arrow.

**Input placeholders.** Show the literal expected format. The repo URL input placeholder is `https://github.com/owner/repo` — not "Enter a GitHub URL".

## Voice in generated documentation

The Mapper and Deep-Dive prompts inherit and enforce this voice. Both prompts forbid emojis, em dashes, and "Here is the document:" preludes. Both require sentence case. The Deep-Dive prompt requires verbatim code quotes rather than paraphrased prose summaries of code.

The generated documentation reads like a technical document written by a careful engineer, not like a chatbot summarizing a codebase. If the model output starts to drift toward marketing copy or chatbot warmth, the prompt is the place to fix it — not the surrounding UI.

~~~
The voice rules are enforced in three places:

1. **Hand-written UI copy** — every label, button, error, toast string in `dist/interfaces/web/src/`.
2. **Mapper prompt** — `MAPPER_PREAMBLE` in `dist/methods/src/common/llmPrompts.ts`. Strict Rules section.
3. **Deep-Dive prompt** — `FILE_ANALYSIS_PREAMBLE` in the same file. Strict Rules section.

If a third AI agent gets added later, its prompt must include the same strict-rules block. The two existing prompts can serve as templates; the rules are at the bottom of each preamble in a clearly-labeled section.
~~~
