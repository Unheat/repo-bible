---
name: Colors
type: design/color
---

```colors
Void:
  value: "#0a0b0d"
  description: Primary background. Almost-black with a faint cool tint, like a code editor at low brightness.
Pane:
  value: "#0d0f12"
  description: Reader and sidebar surfaces. One step above void; signals "content area, focus here".
Surface:
  value: "#111316"
  description: Elevated chrome — buttons at rest, status pills, toolbar. The next layer up from pane.
Border:
  value: "#1f242b"
  description: Default 1px borders. Sharp, low contrast. The frame of every card and panel.
Wire:
  value: "#00d4a4"
  description: The single accent. Mint cyan with circuit-board energy. Used for the primary CTA, focus ring, links inside markdown, and Mermaid node borders. Intentionally rare so it never feels decorative.
Bone:
  value: "#e8eaed"
  description: Primary text and active-state foreground. Off-white, never pure white.
Ash:
  value: "#9aa0a6"
  description: Secondary text, subheads, status meta. Designed to recede without disappearing.
Smoke:
  value: "#5f6368"
  description: Muted captions, timestamps, file paths in lists. The deepest legible text tone.
Amber:
  value: "#f59e0b"
  description: In-progress status. Used for processing and generating pulse indicators only — never as a foreground color.
Crimson:
  value: "#ef4444"
  description: Failure status, error toasts, validation errors. Reserved for true error states.
```

~~~
Derived semantic tokens (see `global.css`):

- `--bg-hover: #1a1d22` — surface elevation on hover (one step above Surface).
- `--bg-active: #232830` — selected sidebar row, pressed state.
- `--border-strong: #2c333d` — borders on hover, dividers, code-block frames where extra prominence helps.
- `--accent-dim: #00aa84` — Wire on hover for primary buttons.
- `--accent-fade: rgba(0, 212, 164, 0.1)` — selection background, mint-tinted overlays.

Status pill mapping:
- `--status-processing` and `--status-generating` → Amber, with a 1.4s pulse animation.
- `--status-completed` → Wire (success doubles as the accent).
- `--status-failed` → Crimson.
- `--status-idle` → Smoke.

The palette is intentionally narrow. There is exactly one accent color (Wire). Every other hue in the app is a status signal with a defined meaning (Amber = working, Crimson = failed). Designers extending the system should resist adding a second accent — instead, use the existing border and surface tokens to create visual hierarchy.
~~~
