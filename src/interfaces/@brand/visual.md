---
name: Visual Identity
description: The dark IDE aesthetic — sharp, technical, monospace-forward, with one rare accent color earning its keep on every appearance.
---

# Visual Identity

Codebase Bible looks and feels like a code editor that happens to be a web app. Pure dark backgrounds, sharp 1px borders, no rounded corners on chrome, monospace for everything technical, Inter for prose. A single mint accent that shows up only where attention is genuinely needed. No gradients, no shadows, no decorative imagery.

The product is for engineers reading documentation about engineering. Every visual decision should reinforce that the tool respects their time and matches the environment they already work in.

~~~
Reference for the rest of this spec: `dist/interfaces/web/src/global.css` (CSS variables and component classes), `dist/interfaces/web/src/components/MarkdownView.tsx` (markdown styling), and the inline styles in `App.tsx`, `HomePage.tsx`, `RepoPage.tsx`. The dark IDE aesthetic is fully implemented; this spec captures the rules that produced it.
~~~

## Surfaces and depth

Four background tones, each with a defined role. Going from deepest to highest:

- **Void** (`#0a0b0d`) — the body background. Empty space.
- **Pane** (`#0d0f12`) — content surfaces with focus: the reader pane, sidebar, code blocks, Mermaid diagrams. One step above void.
- **Surface** (`#111316`) — chrome at rest: buttons, status pills, toolbar bar, repo cards.
- **Hover/active** (`#1a1d22` / `#232830`) — interactive states layered on top of Surface.

This is a four-tone depth system, not a shadow system. Elements rise and fall by changing background tone, never by casting shadows. Box-shadows are not used anywhere in the app.

## Borders, not shadows

Every visible boundary is a sharp 1px line. Cards, buttons, inputs, status pills, code blocks, the toolbar — all framed with `1px solid var(--border)` or `var(--border-strong)`. Hover states elevate the border to `--border-strong` rather than introducing a shadow.

Corner radius is 0 on all chrome. Cards are rectangles. Buttons are rectangles. Pills are rectangles with rounded ends only because the pill shape itself is the affordance. Status indicators (the small colored dot inside a pill) are circles via `border-radius: 50%`. The scrollbar thumb has a subtle 5px radius. Nothing else rounds.

~~~
This is the single most important visual rule and the one most likely to drift. If a future change introduces `border-radius: 6px` or `box-shadow: 0 4px 12px ...`, it breaks the IDE feel and pushes the app toward generic SaaS.

The exception list is exhaustive: pills (3px round-end), scrollbar thumb (5px), status dot (50%), spinner (50%), Mermaid SVG nodes (whatever Mermaid renders by default — they are inside a 1px-bordered Pane container, which preserves the outer rectangular feel).

If a future feature genuinely requires elevated chrome, prefer raising the surface tone over introducing shadows. Layered backgrounds carry depth in this design system; light does not.
~~~

## Accent discipline

Wire mint (`#00d4a4`) is the only accent. It appears in:

- The primary CTA on the home page ("Generate Bible →") and dashboard ("Push to GitHub →").
- The wordmark caret in the top bar.
- The hero eyebrow label.
- The input focus ring.
- Active sidebar row left border.
- Inline `code` foreground inside markdown.
- Markdown link foreground (with a hover-revealed underline).
- The completed status pill dot.
- Mermaid node borders.
- The PR success toast left border and the PR URL link inside it.

That is the entire mint inventory. Mint is rare on purpose — when a user sees it, the meaning is "this is the action" or "this is interactive content." Every additional mint surface dilutes that signal.

Status colors (Amber for in-progress, Crimson for failed) are tightly scoped to status indicators. They never appear as button colors, link colors, or section accents. A failure does not turn a card red; it adds a 3px Crimson left border to the toast or status block.

## Spacing scale

A discrete scale, used everywhere:

- 4px / 8px / 12px / 16px / 24px / 32px / 48px / 64px

These are exposed as `--sp-1` through `--sp-8` in `global.css`. Every padding, margin, and gap in the app should pick from this scale. The home page hero pads 64px from the top; the file rows in the sidebar are 1px gap (intentionally dense, IDE-like); the toast pads 16px / 20px; the markdown reader pads 40px / 56px / 80px on the dashboard.

~~~
The reader's asymmetric padding (40 top, 56 horizontal, 80 bottom) is deliberate. The bottom buffer prevents the last paragraph from flush-bottoming against the viewport. The horizontal padding is generous because the reader has a `max-width: 820px` cap; the extra padding plus the cap means content stays in a comfortable reading column even on ultrawide displays without the outer padding ever feeling cramped.

If you find yourself reaching for a 10px or 18px or 20px value, pick the nearest scale step. Off-scale values quickly create visual noise that shows up most clearly in dense areas like the sidebar.
~~~

## Density and rhythm

The app has two density registers, each appropriate to its context.

**Sidebar / file lists / toolbar** — dense. 1px gaps between rows, 13/11px monospace text, low padding. The user scans these areas like a directory listing; speed of recognition matters more than breathing room.

**Reader / hero / status pages** — generous. Multi-line padding, 15px Inter at 1.65 line-height, 32px between major sections. The user reads these areas; comfort matters more than density.

The two registers should never blend within a single component. A sidebar with prose-like padding feels wrong; a reader with directory-like density is unreadable.

## Motion

Motion exists, but quietly. Three rules:

- **Hover transitions** are 120ms ease, applied to background and border-color. No transform tricks, no scaling, no glow.
- **The status-pulse animation** is 1.4s ease-in-out, opacity 1 → 0.4 → 1. Applied only to the in-progress status dot. Signals "something is happening" without being noisy.
- **Toast slide-in** is 200ms ease-out, translating 20px from the right with opacity fade.

There is no scroll-driven animation. There are no page transitions. There are no idle hover effects on cards beyond background and border tone changes. The IDE aesthetic does not move on its own.

## Layout stability rules

- Buttons that swap to a spinner state must keep a `min-width` so the swap does not change layout. Both the home page submit and the dashboard toolbar buttons enforce this.
- The dashboard grid uses fixed column and row sizes (`320px`, `56px`) plus `1fr` for the content areas, with `min-height: 0` and `overflow: hidden` on the outer container so the inner scrollers behave correctly without pushing siblings around.
- The markdown reader caps at `max-width: 820px` and centers within its pane — content reflow on viewport resize is bounded, not unlimited.
- Mermaid blocks live inside a 1px-bordered Pane container with `overflow: auto`. A diagram wider than the container scrolls horizontally rather than expanding the column.
- Code blocks scroll horizontally when too wide rather than wrapping. Wrapping a long line of code makes it unreadable; horizontal scroll preserves the source structure.

## Imagery

There is none. The app has no illustrations, no stock photos, no decorative gradients, no logo beyond the monospace wordmark. The "logo" is a mint caret (`^`) followed by `codebase-bible` in JetBrains Mono. That is the brand mark.

If imagery is added later (an empty state, a marketing page, a launch announcement), it should follow the same rules as the rest of the visual system: dark surfaces, sharp lines, monospace where appropriate, mint accent used sparingly. Avoid 3D illustrations, gradient blobs, and any visual that would feel at home on a generic SaaS landing page.

~~~
The deliberate absence of imagery is itself a brand statement. Engineers tools that try too hard to be "friendly" with cartoon mascots or pastel illustrations come across as condescending. The Codebase Bible promise is "we respect that you read code for a living"; the visual silence reinforces that.
~~~
