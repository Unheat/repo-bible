---
name: Mobile-Responsive Dashboard
type: roadmap
status: planned
description: The sidebar-and-reader layout reflows for small screens so bibles are readable on any device.
requires: []
effort: small
---

The current layout is a fixed two-column grid. On a phone it overflows and is unreadable. Engineers read documentation on their phones — on the train, in a meeting, reviewing an onboarding doc someone shared. This makes that work.

## What it looks like

On screens under 768px wide, the two-column grid collapses to a single column. The sidebar becomes a collapsible drawer, toggled by a hamburger icon in the top bar. The reader fills the full viewport width. Touch targets on file rows are expanded to 44px minimum height.

The toolbar collapses its secondary actions into an overflow menu ("⋯") on small screens — the repo name and nav link stay visible, but Push to GitHub and Regenerate move into the menu.

The home page ingest form is already reasonably mobile-friendly but gets minor touch target adjustments.

## Key details

- Breakpoint: 768px. Below this, the sidebar is hidden by default and toggled via a hamburger button that appears in the top bar.
- The drawer overlays the reader on mobile — it does not push content, it sits above it at z-index. A tap outside the drawer closes it.
- The reader's padding is reduced on mobile: 20px horizontal (vs 56px on desktop), 24px vertical (vs 40px).
- Font sizes stay constant — the design is already at 13-15px for prose, which is fine on mobile.
- The Mermaid diagram container gets `overflow-x: auto` so wide diagrams scroll horizontally instead of overflowing.
- The toolbar overflow menu is a plain dropdown with the same 1px border style as the rest of the UI.

~~~
CSS-only for most of this. The grid switch, the drawer, and the overflow menu are all achievable with a single media query breakpoint. No new JS logic required beyond the drawer open/closed toggle (one boolean state value in the layout component).

The Mermaid overflow is a one-line CSS fix that should be applied regardless of mobile work.
~~~
