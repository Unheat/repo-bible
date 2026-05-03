---
name: Typography
type: design/typography
---

```typography
fonts:
  Inter:
    src: https://rsms.me/inter/inter.css
  JetBrains Mono:
    src: https://api.fontshare.com/v2/css?f[]=jetbrains-mono@400,500,600,700&display=swap

styles:
  Display:
    font: Inter
    size: 40px
    weight: 700
    letterSpacing: -0.025em
    lineHeight: 1.1
    description: Hero headline on the home page. The headline that anchors the brand. Sharp, confident, slight negative tracking for editorial weight.
  H1:
    font: Inter
    size: 32px
    weight: 700
    letterSpacing: -0.015em
    lineHeight: 1.25
    description: Top-level section headings inside generated markdown. Underlined with a 1px border to mark the start of a major section.
  H2:
    font: Inter
    size: 22px
    weight: 700
    letterSpacing: -0.015em
    lineHeight: 1.25
    description: Sub-section headings inside markdown.
  Body:
    font: Inter
    size: 15px
    weight: 400
    lineHeight: 1.65
    description: Reading text inside the markdown reader. Slightly larger and more leaded than chrome body so long-form documentation feels comfortable.
  UI:
    font: Inter
    size: 14px
    weight: 400
    lineHeight: 1.55
    description: Default UI text — paragraph body in chrome, button labels, default rendered text.
  Eyebrow:
    font: JetBrains Mono
    size: 11px
    weight: 500
    letterSpacing: 0.12em
    case: uppercase
    description: Mint label above the home page hero headline. Section labels in the sidebar. Status pill text. Small, tracked, monospace — sets the technical tone immediately.
  Mono Body:
    font: JetBrains Mono
    size: 13px
    weight: 500
    description: File paths, repo names in lists, toolbar repo name, URL inputs, tagline in the top bar. Anywhere the content is technical and would benefit from monospaced alignment.
  Code:
    font: JetBrains Mono
    size: 13px
    weight: 400
    lineHeight: 1.5
    description: Source code in fenced blocks inside markdown. Syntax-highlighted via highlight.js github-dark theme on top of the app's pane surface.
```

~~~
The pairing is deliberate. **Inter** carries the prose: legible at every weight, optimized for screens, plenty of personality at display sizes without ever feeling decorative. **JetBrains Mono** carries everything code-adjacent: file paths, status pills, eyebrow labels, the wordmark, the URL input, all source code. The split signals "this is a technical product" the moment a user lands on the home page, and gives the markdown reader a clean prose-versus-code rhythm.

There are exactly two font families. Adding a third (a serif, a display face, etc.) would dilute the dual-track logic and is actively discouraged.

Every monospace use also carries letter-spacing tightening or widening that maps to its role:
- Eyebrow labels: 0.12em (very wide) — they read as labels, not words.
- Headings: -0.015em (slightly tight) — they feel chiseled.
- Body / mono body: default tracking — they read as content.

Loading the fonts: Inter via `rsms.me/inter/inter.css` (CDN, no self-hosting). JetBrains Mono via Fontshare. Both are loaded in `index.html` so the first paint has both faces available; the local `font-mono` and `font-sans` CSS variables in `global.css` reference them and fall back to system stacks.
~~~
