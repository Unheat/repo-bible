---
name: Web Interface
description: The browser-based UI. Two routes (home, dashboard), live polling, an in-page markdown reader with Mermaid support, and a one-click Push-to-GitHub button.
---

# Web Interface

A two-route React application built with Vite. Visually a dark IDE: pure black surfaces, sharp 1px borders, mint accent, JetBrains Mono for chrome and code, Inter for prose. Single-tenant, no auth, fullscreen.

~~~
Stack: Vite + React 19 + TypeScript. Routing via `wouter` (lightweight, hooks-based). Markdown rendering via `react-markdown` v9 with `remark-gfm` (tables, task lists, strikethrough) and `rehype-highlight` (auto-detected language highlighting). Mermaid via the `mermaid` package, lazy-initialized once. State management is local component state — no Zustand, no SWR. Polling is hand-rolled with `setTimeout` recursion because the polling needs are simple and the visible state is small.

The frontend talks to the backend through the typed `createClient` from `@mindstudio-ai/interface`. The contract lives in `dist/interfaces/web/src/api.ts` and mirrors the backend method return types exactly.

`web.json` is minimal: default Vite dev port 5173, `npm run dev`, desktop preview mode.
~~~

## Top Bar

A persistent header across both routes. Left side: monospace wordmark `^ codebase-bible` (the caret is mint, the rest is white text). The whole element is a link back to the home route. Right side: a small monospace tagline "AI-generated docs for any GitHub repo" in muted text. Bordered along the bottom with a 1px line in the standard border color.

~~~
Implemented inline in `dist/interfaces/web/src/App.tsx`. The wordmark uses `font-mono` at 14px / weight 600 / letter-spacing -0.01em. The tagline uses `font-mono` at 12px in `--text-muted`.

`user-select: none` on the header so the wordmark area feels like app chrome, not document content.
~~~

## Route: `/` — Home Page

A single centered column up to 720px wide, padded 64px from the top. Three regions, top to bottom.

**Hero.** A small mint eyebrow label in monospace (uppercase, letter-spaced 0.12em): "AI-generated onboarding docs". Below it, the main headline in a 40px, weight 700, letter-spacing -0.025em, line-height 1.1 sans-serif: "Read any codebase / like you wrote it." (with an explicit line break). Beneath the headline, a 16px subhead in the secondary text color explaining what the app does and how the two agents work.

**Ingest form.** A horizontal form: a monospace `type="url"` input with the placeholder `https://github.com/owner/repo`, autofocus on mount. A primary mint button to its right reading "Generate Bible →". On submit the button shows a spinner inline (replacing the label without a width change). After a successful response the page navigates immediately to `/repos/:id?autogenerate=1` — the home page never blocks waiting on the AI pipeline.

Beneath the form, in muted monospace: "Public repos work without configuration. Private repos and PR creation require a GITHUB_TOKEN secret."

**Repo list.** A monospace section label "Repositories" above a vertical stack of repo rows. Each row is a clickable button (using `all: unset` to strip native button chrome) styled as a 1px-bordered card. Inside the card: repo name in monospace at the left, two status pills at the right ("ingest *status*" and "docs *status*"). Below the name, a muted monospace meta line: "12 files ingested · 12 documented · architecture ready" (the suffix segments only appear when applicable). Hovering swaps the background and elevates the border. Clicking navigates to that repo's dashboard.

The list polls `listRepositories` every 5 seconds so any repo currently processing or generating shows live status. While loading on first paint, the list renders three skeleton cards (68px tall, half-opacity, no shimmer).

~~~
Implementation in `dist/interfaces/web/src/pages/HomePage.tsx`.

Submit error handling: `ingestRepository` errors render as an inline message under the form — a 10/14px padded block with a 3px left border in the failure status color, monospace at 12px.

Polling pattern: a single recursive `setTimeout` in a `useEffect`, with a `cancelled` flag to defend against late responses arriving after unmount. Errors are logged to console but don't disrupt the UI; the next tick will retry.

Empty state: monospace muted text reading "No repositories yet. Drop a URL in the box above to start." Padded 32px vertically, no decoration.

Status pills: see the visual identity spec for the exact pill styling. The status string is concatenated with the role ("ingest", "docs") so the pills read like sentence fragments rather than naked enum values.
~~~

## Route: `/repos/:id` — Dashboard

A polymorphic route that switches between five visual states based on the repository's `(status, docsStatus)` pair. The route reads `?autogenerate=1` from the query string on mount and uses it as a one-shot signal to fire `generateBible` automatically once ingestion completes.

### State machine

| `status` | `docsStatus` | View |
|---|---|---|
| (loading) | (loading) | **Loading** — minimal centered "Loading…" |
| `processing` | any | **Ingesting** — full-screen status with spinner |
| `failed` | any | **Ingestion failed** — full-screen error with home link |
| `completed` | `idle` | **Ready to generate** — full-screen with a "Generate Bible" button |
| `completed` | `generating` | **Generating** — full-screen status, mentions Mapper → Deep-Dive |
| `completed` | `failed` | **Generation failed** — full-screen error with retry button |
| `completed` | `completed` | **Ready** — full dashboard (toolbar, sidebar, reader) |

~~~
Implementation in `dist/interfaces/web/src/pages/RepoPage.tsx`. The route polls `getRepositoryDetail` every 3 seconds while either status is non-terminal, then stops polling once both settle (`completed` or `failed` on each).

The full-screen status component is a centered column: large title, secondary subtitle, optional spinner, optional secondary button (e.g. "Generate Bible" on the idle state, "Retry" on the failed state). Backgrounded by `--bg-pane`, padded generously.

The auto-generate effect: a small piece of state (`autogenerateConsumed`) ensures the trigger fires exactly once per page session even if `useEffect` re-runs. After firing, the URL is rewritten in place via `navigate(.../repos/:id, { replace: true })` to strip `?autogenerate=1` so a manual refresh doesn't re-fire.
~~~

### Ready-state layout

A CSS grid filling the viewport below the top bar:

```
grid-template-columns: 320px 1fr
grid-template-rows: 56px 1fr
grid-template-areas:
  "toolbar toolbar"
  "sidebar reader"
```

**Toolbar (top, 56px).** Left: a `← all repos` link in muted monospace, then a thin vertical divider, then the repo name in monospace 14px / weight 600, then a `↗ source` link to the GitHub URL (opens new tab). Right: two buttons — a ghost "Regenerate" button and a primary mint "Push to GitHub →" button.

Both action buttons replace their label with an inline spinner during async work — fixed minimum width so there is no layout shift. Regenerate fires `generateBible`, after which polling picks up `docsStatus: 'generating'` and the page automatically transitions back to the generating full-screen state. Push fires `openDocumentationPR` and surfaces the result as a toast.

**Sidebar (left, 320px).** Background is `--bg-pane`, right border 1px. Two sections, both with monospace 10px / 0.12em-tracked uppercase labels.

The first section is "Overview" with a single row: "Architecture / Mermaid + summary" if the overview exists, or "Architecture / Not generated" (greyed and unclickable) if it doesn't.

The second section is "Files" with the file count on the right. Below, an alphabetical list of every file in the repo. Each file row is dense (lower-padded than the home page rows): the file path in monospace at 13px, the language token in muted monospace at 11px below it. Files with `hasDoc: true` are clickable and full-opacity; files without are 0.4 opacity and not clickable. The currently selected row gets a mint left border and a slightly elevated background.

**Reader (right, fills remaining width).** Padded 40px / 56px / 80px (top / horizontal / bottom). Above the markdown content, a meta line in muted monospace giving the source path being viewed. The markdown itself uses the shared `MarkdownView` component (see below). Maximum reading width 820px so paragraphs stay legible on ultrawide displays.

When `view.kind === 'overview'`, the reader shows the latest `repo_overview` document. When `view.kind === 'file'`, it shows the latest `file_deepdive` for the selected file via the pre-built `fileDocsByFileId` map (O(1) lookup, no joins on the client).

~~~
The grid uses `min-height: 0` and `overflow: hidden` on the outer container so the sidebar and reader can scroll independently. Sidebar is `overflow-y: auto`; reader is the same.

Toast container: fixed bottom-right, 24px from each edge, 1px border with a 3px left border in the success or failure status color. Auto-dismisses after 8 seconds. Includes the toast message and, on PR success, a clickable mint link to the PR URL in monospace 12px.

The toolbar buttons disable themselves while their respective async call is in flight (using a local `pushing` / `regenerating` boolean). No double-click protection beyond that — repeated pushes are mostly harmless because the backend is idempotent on the document set, but a duplicate PR can occur if the user spams the button before the toast lands.
~~~

## Markdown Rendering

A single `MarkdownView` component handles every piece of generated documentation in the app. It uses `react-markdown` with `remark-gfm` and `rehype-highlight`, plus a custom code component that intercepts the `mermaid` language fence and routes it to `mermaid.render` instead of the highlighter.

Code fences with any language other than `mermaid` get syntax highlighting via `highlight.js`'s `github-dark` theme, with a custom palette override layered on top so the highlighter colors match the app's accent and surface tokens. Inline code uses the mint accent on a slightly elevated background. Headings use Inter at sharply tracked sizes, with `h1` underlined by a 1px border. Tables use a monospace uppercase header row.

The Mermaid block lazy-initializes mermaid on first use with a custom dark theme matching the app palette: black background, dark grey nodes, mint borders on nodes, JetBrains Mono font, basis curves, 20px flowchart padding. Each rendered block is wrapped in a 1px-bordered surface with `--bg-pane` background and 24px internal padding. If mermaid throws, the block falls back to an inline error display showing the parser message and the raw chart source.

~~~
Component path: `dist/interfaces/web/src/components/MarkdownView.tsx`. The component owns its own styles via an inline `<style>` block scoped under `.markdown-view` so they cannot leak globally.

Heading hierarchy: h1 32px, h2 22px, h3 18px, h4 15px (uppercase, letter-spaced, secondary color — used as section labels rather than true subheadings). Paragraph margin 12px top/bottom, line-height 1.65 on a 15px base.

Code style: monospace 0.88em, with inline code on `--bg-elevated` and the mint accent for the foreground. Fenced blocks on `--bg-pane` with 1px border, 16px / 20px padding, horizontal scroll for long lines.

Mermaid theme variables (passed to `mermaid.initialize`): `mainBkg: '#1a1d22'`, `nodeBorder: '#00d4a4'`, `lineColor: '#5f6368'`, `fontFamily: 'JetBrains Mono, monospace'`. `securityLevel: 'loose'` to allow markdown-style labels inside nodes.

A unique random ID per Mermaid block prevents collisions when multiple charts render on the same page. The render call is wrapped in a `cancelled` flag so a fast doc switch doesn't overwrite the new chart's SVG with the old chart's late-arriving result.
~~~

## Polling & Live Updates

The frontend never receives push events from the backend. Both views poll: the home page polls the repo list every 5 seconds, the dashboard polls the active repository every 3 seconds. Polling stops once the relevant state machine reaches a terminal state on both axes.

Polling is intentionally simple. There is no SWR, no React Query, no websocket. The data set is small (a handful of repositories per app), the round-trip cost is low, and the tightest interactive moment (regenerate → status flips to generating) needs at most a 3-second perceptual delay before the UI catches up.

~~~
Both polling effects use the same pattern: a `cancelled` ref defended in every async branch, a `timer` ref cleaned up on unmount, recursive `setTimeout` (not `setInterval` — we want strict serialization, no overlap if a request is slow).

When the dashboard fires `generateBible` from the Regenerate button, the local UI state intentionally does not optimistically flip to `generating`. The next poll tick (3 seconds max) brings the new `docsStatus` and the polymorphic route handles the transition automatically. This keeps the optimistic-update logic in one place: the polling effect.
~~~

## Out of Scope

- **Mobile responsive dashboard.** Layout assumes desktop. The 320px sidebar plus 820px reader doesn't fit a phone.
- **Deep linking inside the dashboard.** The currently-viewed file is component state, not URL state. Refresh or share-link drops back to the overview.
- **Auth UI.** No login, no signup, no user menu. The whole app is single-tenant.
- **Streaming markdown render.** The Deep-Dive output appears all-at-once when the row lands. Streaming the model's tokens through to the reader would be a meaningful UX upgrade for large files.
- **Optimistic UI on generate / regenerate.** Currently relies on the next poll tick.
