### 1. File Purpose
This file provides utility functions to sanitize Mermaid diagram syntax within a documentation generation system. Its primary role is to ensure that node labels and edge labels in Mermaid flowcharts are properly quoted with double quotes, preventing parsing errors caused by special characters (e.g., parentheses, brackets, hyphens) that are common in code and technical labels. This supports the broader system's goal of generating reliable, machine-readable documentation from code repositories.

### 2. Architecture and Design Patterns
This file is a stateless utility library, following a **helper/module pattern**. It does not implement business logic but provides pure functions for text transformation. It fits into the broader architecture as a cross-cutting concern for the documentation generation pipeline: the `generateBible.ts` service (which produces Markdown with Mermaid diagrams) would call `sanitizeMermaidInMarkdown` to clean output before storing it in the database or rendering it in the frontend. The file is part of the `backend/src/lib/` layer, which contains shared utilities for processing text, GitHub data, and LLM outputs.

### 3. Public Interface
All exported functions are pure and synchronous.

```typescript
export function sanitizeMermaidLabel(text: string): string
```
- **Parameters**: `text: string` - The label text to sanitize.
- **Returns**: `string` - The sanitized label, wrapped in double quotes if needed, with internal quotes escaped.
- **Purpose**: Sanitizes a single Mermaid label by ensuring it is properly quoted and escaping internal double quotes.

```typescript
export function sanitizeMermaidDiagram(mermaidCode: string): string
```
- **Parameters**: `mermaidCode: string` - The raw Mermaid diagram code (e.g., flowchart syntax).
- **Returns**: `string` - The sanitized Mermaid diagram code with all node and edge labels properly quoted.
- **Purpose**: Processes an entire Mermaid diagram, applying label sanitization to node definitions (e.g., `[Label]`, `[[Label]]`, `[(Label)]`) and edge labels (e.g., `-->|Label|`).

```typescript
export function sanitizeMermaidInMarkdown(markdown: string): string
```
- **Parameters**: `markdown: string` - Markdown content that may contain Mermaid code blocks.
- **Returns**: `string` - The markdown with sanitized Mermaid diagrams inside fenced code blocks.
- **Purpose**: Extracts Mermaid code blocks from Markdown and sanitizes each diagram using `sanitizeMermaidDiagram`.

### 4. Internal Logic Walkthrough
The file contains three functions, with `sanitizeMermaidDiagram` being the most complex.

**`sanitizeMermaidLabel`**:
- Checks if the input is empty; returns `""` if so.
- Trims the text and checks if it's already quoted with double quotes. If so, it escapes any internal unescaped quotes using a negative lookbehind regex (`/(?<!\\)"/g`), then returns the quoted string.
- If not quoted, it escapes internal quotes and wraps the entire string in double quotes.

```typescript
export function sanitizeMermaidLabel(text: string): string {
  if (!text || text.trim() === '') {
    return '""';
  }

  const trimmed = text.trim();

  // If already properly quoted with double quotes at start and end, return as-is
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length > 1) {
    // Escape any internal unescaped quotes
    const inner = trimmed.slice(1, -1);
    const escaped = inner.replace(/(?<!\\)"/g, '\\"');
    return `"${escaped}"`;
  }

  // Escape any internal quotes and wrap in double quotes
  const escaped = trimmed.replace(/(?<!\\)"/g, '\\"');
  return `"${escaped}"`;
}
```

**`sanitizeMermaidDiagram`**:
- Splits the input into lines and processes each line individually.
- Skips empty lines, comments (starting with `%%`), and graph declaration lines (starting with `graph ` or `flowchart `).
- For other lines, it applies a series of regex replacements to handle different Mermaid node shapes (e.g., rectangle, subroutine, cylindrical, stadium, circle, hexagon, diamond) and edge labels. Each pattern checks if the label is already quoted using a helper `isQuoted` function; if not, it sanitizes the label via `sanitizeMermaidLabel` and reconstructs the node/edge syntax.
- The regex patterns are ordered to avoid conflicts (e.g., subroutine `[[Label]]` is matched before rectangle `[Label]`).
- Finally, it joins the sanitized lines back into a string.

```typescript
// Pattern 1: Rectangle nodes A[Label] - must not match A[[...]] or A[(...)]
sanitizedLine = sanitizedLine.replace(
  /(\w+)\[(?!\[|\()([^\]]+)\](?!\])/g,
  (match, nodeId, label) => {
    if (isQuoted(label)) return match;
    return `${nodeId}[${sanitizeMermaidLabel(label)}]`;
  }
);

// Pattern 9: Edge labels like -->|Label| or ---|Label|---
sanitizedLine = sanitizedLine.replace(
  /(\-+>?)\|([^|]+)\|/g,
  (match, arrow, label) => {
    if (isQuoted(label)) return match;
    return `${arrow}|${sanitizeMermaidLabel(label)}|`;
  }
);
```

**`sanitizeMermaidInMarkdown`**:
- Uses a regex to find all fenced Mermaid code blocks (```mermaid ... ```).
- For each match, it extracts the Mermaid code, sanitizes it with `sanitizeMermaidDiagram`, and replaces the block with the sanitized version.

```typescript
export function sanitizeMermaidInMarkdown(markdown: string): string {
  if (!markdown) {
    return markdown;
  }

  // Match ```mermaid code blocks
  const mermaidBlockRegex = /```mermaid\n([\s\S]*?)```/g;

  return markdown.replace(mermaidBlockRegex, (match, mermaidCode) => {
    const sanitized = sanitizeMermaidDiagram(mermaidCode);
    return '```mermaid\n' + sanitized + '```';
  });
}
```

### 5. Dependencies and Integrations
- **Internal Imports**: None. This file is self-contained and does not import any other modules from the codebase.
- **External Dependencies**: None. The file uses only built-in JavaScript/TypeScript features (e.g., `String.prototype.replace`, regex with lookbehind). No third-party libraries are imported.

### 6. Edge Cases and Error Handling
- **Empty Input**: Both `sanitizeMermaidLabel` and `sanitizeMermaidDiagram` handle empty or whitespace-only input by returning a default quoted empty string (`""`) or the original input, respectively.
- **Already Quoted Labels**: The `isQuoted` helper in `sanitizeMermaidDiagram` prevents double-quoting and ensures internal quotes are escaped.
- **Special Characters**: The regex patterns use negative lookaheads/lookbehinds to avoid matching unintended syntax (e.g., `A[[Label]]` is not matched as a rectangle node).
- **Malformed Diagrams**: The function processes line-by-line, so errors in one line do not affect others. However, it does not validate overall Mermaid syntax correctness.
- **Markdown with No Mermaid**: `sanitizeMermaidInMarkdown` returns the original markdown if no Mermaid blocks are found.

### 7. Observations
- **Code Duplication**: The `isQuoted` helper is defined inline within `sanitizeMermaidDiagram` and could be extracted for reuse, but it's only used there.
- **Regex Complexity**: The multiple regex patterns for node shapes are ordered carefully but may be brittle if Mermaid syntax evolves. The code includes a duplicate block for "Stadium shape" (Pattern 4 appears twice), which is a minor copy-paste error but does not affect functionality as the second instance is identical.
- **No Error Logging**: The functions silently handle edge cases without logging, which is acceptable for utilities but may hinder debugging in production.
- **Performance**: For large diagrams, the line-by-line processing and multiple regex replacements per line could be optimized, but it's likely negligible for typical documentation use cases.