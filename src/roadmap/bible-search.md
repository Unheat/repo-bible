---
name: Search the Bible
type: roadmap
status: planned
description: Full-text search across the entire generated bible — find every file that mentions a concept, pattern, or function name instantly.
requires: ["deep-link-routing.md"]
effort: medium
---

A bible for a 200-file repo is a lot of documentation. Without search, the user is stuck clicking through the sidebar hoping to land on the right file. Search makes the bible as useful as a codebase search tool — type a concept, see every file that covers it.

## What it looks like

A search input appears at the top of the sidebar, above the Overview row. It's always visible, not hidden behind a hotkey. Typing into it filters the sidebar list in real-time — files whose deep-dive writeup contains the query are shown and ranked by match count; non-matching files are hidden. The architecture overview section is also matched against (if the query appears in the overview, an "Architecture" result appears above the file results).

Matched excerpts appear below each file name in the filtered list: a short snippet of the matching passage, with the query terms highlighted in mint. Clicking a result navigates to that file's writeup and scrolls to the first match (via URL hash).

A keyboard shortcut (`Cmd+K` / `Ctrl+K`) focuses the search input from anywhere in the dashboard.

## Key details

- Search is client-side for repos up to ~500 files. The full document set is already in memory from `getRepositoryDetail`. A simple substring match across `markdownContent` is fast enough at that scale.
- Ranking: exact phrase matches rank above individual term matches. Match count (number of occurrences) is the secondary sort key.
- The search input debounces at 150ms to avoid re-ranking on every keystroke.
- Empty search restores the full sidebar with the currently-selected file still highlighted.
- The search state is not reflected in the URL (the file URL stays as-is; the search is ephemeral UI state).
- For repos over 500 files, fall back to a server-side `searchBible({ repositoryId, query })` method that does a full-text scan of the `generated_docs` table.

~~~
Client-side: build a search index on the component's first render after docs load. Index is a plain array of `{ fileId, filePath, markdownContent }`. The filter function does `markdownContent.toLowerCase().includes(query.toLowerCase())` per entry, with a score of `(markdownContent.match(queryRegex) || []).length`. Sort descending by score.

Excerpt extraction: find the first occurrence of the query in the content, extract 80 characters before and after, strip markdown syntax characters (`#`, `*`, `` ` ``) for cleaner display.

Scroll-to-match: include the match offset as a URL hash (`#match-0`). The MarkdownView component listens for this hash and scrolls the first highlighted span into view on mount.
~~~
