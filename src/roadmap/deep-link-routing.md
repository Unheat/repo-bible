---
name: Deep-Link Routing
type: roadmap
status: planned
description: The selected file or section is reflected in the URL so any view inside the dashboard can be shared or bookmarked directly.
requires: []
effort: quick
---

The currently-viewed file lives in component state. Refreshing the page drops back to the architecture overview. Sharing the URL with a teammate sends them to the wrong document. Deep-link routing puts the selection in the URL where it belongs.

## What it looks like

The dashboard URL changes from `/repos/:id` to `/repos/:id/overview` and `/repos/:id/file/:filePath`. Navigating the sidebar updates the URL. The browser back button works. Sharing the URL drops the recipient directly on the right document.

## Key details

- Route pattern: `/repos/:id/overview` for the architecture overview (default), `/repos/:id/file/*` for a file path (the `*` captures slashes so `src/foo/bar.ts` works).
- On initial load, if no sub-route is present, default to `/overview`. If the sub-route points to a file that doesn't exist in the repo (e.g., the file was pruned in a re-ingest), fall back to `/overview` with a muted "File not found" notice.
- The sidebar's selected state is now derived from the URL, not local state. Clicking a file calls `navigate()`, which updates the URL, which updates the active item.
- The `?autogenerate=1` query param behavior is unchanged — it fires once on mount and is then stripped.

~~~
Replace the local `view` state object in `RepoPage.tsx` with URL-derived state using `wouter`'s `useRoute` / `useLocation`. The sidebar `onClick` calls `navigate` to the new URL. The reader renders based on the matched route, not a state value.

File paths in URLs: encode the file path with `encodeURIComponent` for the path segments (or just replace `/` with `~` as a safe single-segment encoding). The decode on read is the inverse. Whichever scheme is chosen, it must round-trip through the URL without ambiguity.
~~~
