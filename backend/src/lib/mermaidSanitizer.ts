/**
 * Mermaid diagram sanitization utilities.
 * 
 * Ensures that all node labels and edge labels in Mermaid diagrams are properly
 * quoted to prevent parsing errors from special characters like (, ), ?, -, etc.
 */

/**
 * Sanitize a single label by wrapping it in double quotes if needed.
 * Handles labels that may already be quoted or contain quotes.
 * 
 * @param text - The label text to sanitize
 * @returns The sanitized label, properly quoted
 */
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

/**
 * Sanitize an entire Mermaid diagram by ensuring all node and edge labels
 * are properly quoted.
 * 
 * This function processes Mermaid flowchart syntax (graph TD/LR) and wraps
 * all node labels in double quotes to prevent parsing errors.
 * 
 * @param mermaidCode - The raw Mermaid diagram code
 * @returns The sanitized Mermaid diagram code
 */
export function sanitizeMermaidDiagram(mermaidCode: string): string {
  if (!mermaidCode || mermaidCode.trim() === '') {
    return mermaidCode;
  }

  const lines = mermaidCode.split('\n');
  const sanitizedLines: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines, comments, and graph declaration lines
    if (
      trimmedLine === '' ||
      trimmedLine.startsWith('%%') ||
      trimmedLine.startsWith('graph ') ||
      trimmedLine.startsWith('flowchart ')
    ) {
      sanitizedLines.push(line);
      continue;
    }

    // Process lines with node definitions and connections
    let sanitizedLine = line;
    
    // Helper to check if already quoted
    const isQuoted = (text: string): boolean => {
      const trimmed = text.trim();
      return trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length > 1;
    };

    // Pattern 1: Rectangle nodes A[Label] - must not match A[[...]] or A[(...)]
    sanitizedLine = sanitizedLine.replace(
      /(\w+)\[(?!\[|\()([^\]]+)\](?!\])/g,
      (match, nodeId, label) => {
        if (isQuoted(label)) return match;
        return `${nodeId}[${sanitizeMermaidLabel(label)}]`;
      }
    );

    // Pattern 2: Subroutine shape A[[Label]] - must match before single bracket
    sanitizedLine = sanitizedLine.replace(
      /(\w+)\[\[([^\]]+)\]\]/g,
      (match, nodeId, label) => {
        if (isQuoted(label)) return match;
        return `${nodeId}[[${sanitizeMermaidLabel(label)}]]`;
      }
    );

    // Pattern 3: Cylindrical shape A[(Label)]
    sanitizedLine = sanitizedLine.replace(
      /(\w+)\[\(([^)]+)\)\]/g,
      (match, nodeId, label) => {
        if (isQuoted(label)) return match;
        return `${nodeId}[(${sanitizeMermaidLabel(label)})]`;
      }
    );

    // Pattern 4: Stadium shape A([Label])
    sanitizedLine = sanitizedLine.replace(
      /(\w+)\(\[([^\]]+)\]\)/g,
      (match, nodeId, label) => {
        if (isQuoted(label)) return match;
        return `${nodeId}([${sanitizeMermaidLabel(label)}])`;
      }
    );

    // Pattern 5: Circle A((Label))
    sanitizedLine = sanitizedLine.replace(
      /(\w+)\(\(([^)]+)\)\)/g,
      (match, nodeId, label) => {
        if (isQuoted(label)) return match;
        return `${nodeId}((${sanitizeMermaidLabel(label)}))`;
      }
    );

    // Pattern 6: Round edges A(Label) - must not match A((...)) or A([...])
    sanitizedLine = sanitizedLine.replace(
      /(\w+)\((?!\(|\[)([^)]+)\)(?!\))/g,
      (match, nodeId, label) => {
        if (isQuoted(label)) return match;
        return `${nodeId}(${sanitizeMermaidLabel(label)})`;
      }
    );

    // Pattern 7: Hexagon A{{Label}}
    sanitizedLine = sanitizedLine.replace(
      /(\w+)\{\{([^}]+)\}\}/g,
      (match, nodeId, label) => {
        if (isQuoted(label)) return match;
        return `${nodeId}{{${sanitizeMermaidLabel(label)}}}`;
      }
    );

    // Pattern 8: Diamond shape A{Label} - must not match A{{...}}
    sanitizedLine = sanitizedLine.replace(
      /(\w+)\{(?!\{)([^}]+)\}(?!\})/g,
      (match, nodeId, label) => {
        if (isQuoted(label)) return match;
        return `${nodeId}{${sanitizeMermaidLabel(label)}}`;
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

    sanitizedLines.push(sanitizedLine);
  }

  return sanitizedLines.join('\n');
}

/**
 * Extract and sanitize Mermaid code blocks from markdown content.
 * Finds ```mermaid fenced code blocks and sanitizes their content.
 * 
 * @param markdown - The markdown content containing Mermaid diagrams
 * @returns The markdown with sanitized Mermaid diagrams
 */
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

// Made with Bob
