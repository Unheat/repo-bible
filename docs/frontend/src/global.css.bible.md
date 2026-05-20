### 1. File Purpose
This file defines the global CSS styles and design tokens for the frontend application, establishing a dark, IDE-inspired visual theme with a mint/cyan accent color. It serves as the foundational stylesheet for the React application, providing consistent styling for UI components, typography, spacing, and interactive states across the entire user interface.

### 2. Architecture and Design Patterns
This file is a global stylesheet, not a component or module with architectural patterns. It follows a **design token** pattern, using CSS custom properties (`:root` variables) to define a centralized color palette, typography, and spacing scale. This enables consistent theming and easy adjustments. It fits into the broader frontend architecture as the base styling layer for all React components, supporting the application's dark theme and IDE-like aesthetic described in the architecture context.

### 3. Public Interface
This file does not export functions, classes, or types. It is a CSS stylesheet that defines global styles and custom properties. The public interface is the set of CSS custom properties (variables) and class names that can be used by React components:

- **CSS Custom Properties (Variables)**: Defined in `:root` for colors, typography, and spacing (e.g., `--bg`, `--accent`, `--font-sans`).
- **Class Names**: Utility classes like `.btn`, `.input`, `.status-pill`, `.spinner`, `.toast` for styling components.

### 4. Internal Logic Walkthrough
The file defines design tokens and component styles in a structured manner:

1. **Design Tokens (`:root` block)**: Defines CSS custom properties for surfaces, borders, text, accent colors, status states, typography, and spacing. This centralizes theme values for reuse.
   ```css
   :root {
     /* Surfaces */
     --bg: #0a0b0d;
     --bg-elevated: #111316;
     /* ... other tokens ... */
   }
   ```

2. **Global Resets**: Applies `box-sizing: border-box` to all elements and sets full-height, margin/padding resets for `html`, `body`, and `#root` to ensure consistent layout.
   ```css
   * {
     box-sizing: border-box;
   }
   
   html,
   body,
   #root {
     height: 100%;
     margin: 0;
     padding: 0;
   }
   ```

3. **Body Styling**: Sets base typography and anti-aliasing for the body element, using the defined design tokens.
   ```css
   body {
     background: var(--bg);
     color: var(--text);
     font-family: var(--font-sans);
     /* ... */
   }
   ```

4. **Interactive States**: Defines styles for selection, scrollbars, buttons, inputs, status pills, spinners, and toasts. For example, buttons have hover and disabled states, and status pills use pseudo-elements for colored indicators with animations.
   ```css
   .btn {
     /* ... */
     transition: background 120ms, border-color 120ms;
   }
   .btn:hover:not(:disabled) {
     background: var(--bg-hover);
     border-color: var(--border-strong);
   }
   ```

5. **Syntax Highlighting Override**: Customizes the Highlight.js theme for code blocks to match the dark theme, using specific color values for keywords, strings, etc.
   ```css
   .hljs {
     background: var(--bg-pane);
     color: #d4d4d4;
   }
   /* ... */
   ```

6. **Sidebar and File Tree Fixes**: Includes specific styles to handle overflow and layout issues in the sidebar and file tree components, ensuring proper scrolling and text truncation.
   ```css
   aside[style*="gridArea"] {
     display: flex;
     flex-direction: column;
     height: 100%;
     overflow: hidden;
     width: 100%;
   }
   /* ... */
   ```

### 5. Dependencies and Integrations
- **Internal Dependencies**: This file styles components from the React frontend (e.g., `SidebarTree.tsx`, `MarkdownView.tsx`). It references class names and structures used by these components, but the implementation of those components is not in scope.
- **External Dependencies**: 
  - **Highlight.js**: The file overrides its theme for syntax highlighting. Highlight.js is a syntax highlighting library; this file provides a custom color scheme for it.
  - **Fonts**: Uses 'Inter' and 'JetBrains Mono' fonts, which are likely loaded via Google Fonts or a similar service (implementation not in scope).
- **No other imports or requires** are present in this file.

### 6. Edge Cases and Error Handling
- **Disabled States**: Buttons and interactive elements have `:disabled` states with reduced opacity and non-allowed cursors to prevent interaction.
- **Overflow Handling**: The sidebar styles include `overflow-x: hidden` and `min-width: 0` to prevent horizontal scrolling and ensure text truncation for long filenames.
- **Animation Fallbacks**: Animations like `pulse` and `spin` are defined with keyframes, but no fallbacks for reduced motion are provided, which could be an accessibility concern.
- **No Explicit Error Styles**: Error states are handled via status pills and toasts (e.g., `.toast.is-error`), but there are no global error recovery mechanisms in this CSS file.

### 7. Observations
- **Code Duplication**: The status pill styles are duplicated in the source code (lines 100-120 and 125-135), which appears to be a copy-paste error. This could lead to maintenance issues.
- **Accessibility**: No explicit focus styles for all interactive elements (e.g., inputs have focus borders, but buttons rely on default outlines). The `focus-visible` pseudo-class is used for tree nodes, but not universally.
- **Hardcoded Colors**: Some colors in the Highlight.js override are hardcoded (e.g., `#c678dd` for keywords), which may not align perfectly with the design tokens. This could be intentional for syntax highlighting but might require updates if the theme changes.
- **Vietnamese Comments**: Comments in Vietnamese (e.g., "Quan trọng: ép nó không được giãn ra theo nội dung") suggest non-English documentation, which could hinder collaboration in a multilingual team.