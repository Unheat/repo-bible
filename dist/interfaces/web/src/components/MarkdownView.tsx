/**
 * Markdown renderer with three special behaviors:
 *  1. ```mermaid fences render as Mermaid flowcharts (lazy-init).
 *  2. All other code fences get syntax highlighting via highlight.js.
 *  3. Layout is content-first, generous, with strong heading hierarchy.
 *
 * react-markdown v9 + remark-gfm (tables, task lists, strikethrough)
 * + rehype-highlight (auto-detected languages with hljs class names).
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import mermaid from 'mermaid';
import 'highlight.js/styles/github-dark.css';

// One-time mermaid init. Theme matches the app palette.
let mermaidInitialized = false;
function ensureMermaid() {
  if (mermaidInitialized) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    themeVariables: {
      darkMode: true,
      background: '#0d0f12',
      primaryColor: '#1a1d22',
      primaryTextColor: '#e8eaed',
      primaryBorderColor: '#2c333d',
      lineColor: '#5f6368',
      secondaryColor: '#111316',
      tertiaryColor: '#0a0b0d',
      mainBkg: '#1a1d22',
      nodeBorder: '#00d4a4',
      clusterBkg: '#0d0f12',
      clusterBorder: '#2c333d',
      edgeLabelBackground: '#0a0b0d',
      fontFamily: 'JetBrains Mono, monospace',
    },
    securityLevel: 'loose',
    flowchart: { curve: 'basis', padding: 20 },
  });
  mermaidInitialized = true;
}

/**
 * Mermaid block — receives the source text inside a ```mermaid fence,
 * renders it to SVG via `mermaid.render`, and inserts the SVG into the
 * DOM. Re-renders when the content changes (different doc selected).
 */
function MermaidBlock({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef(`mermaid-${Math.random().toString(36).slice(2, 11)}`);

  useEffect(() => {
    ensureMermaid();
    let cancelled = false;
    setError(null);
    mermaid
      .render(idRef.current, chart)
      .then(({ svg }) => {
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message ?? String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [chart]);

  if (error) {
    return (
      <div
        style={{
          border: '1px solid var(--border)',
          borderLeft: '3px solid var(--status-failed)',
          padding: '16px 20px',
          margin: '16px 0',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--text-secondary)',
          background: 'var(--bg-pane)',
        }}
      >
        <div style={{ color: 'var(--status-failed)', marginBottom: 8 }}>
          Mermaid render error
        </div>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{error}</pre>
        <pre
          style={{
            margin: '12px 0 0',
            whiteSpace: 'pre-wrap',
            color: 'var(--text-muted)',
            fontSize: 11,
          }}
        >
          {chart}
        </pre>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="mermaid-block"
      style={{
        margin: '24px 0',
        padding: 24,
        background: 'var(--bg-pane)',
        border: '1px solid var(--border)',
        overflow: 'auto',
      }}
    />
  );
}

interface MarkdownViewProps {
  content: string;
}

export default function MarkdownView({ content }: MarkdownViewProps) {
  return (
    <div className="markdown-view">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // Custom code component to detect ```mermaid fences.
          code(props) {
            const { className, children, ...rest } = props;
            const match = /language-(\w+)/.exec(className ?? '');
            const lang = match?.[1];
            const text = String(children ?? '').replace(/\n$/, '');

            // Mermaid fence -> render to SVG.
            if (lang === 'mermaid') {
              return <MermaidBlock chart={text} />;
            }

            // Inline code (no language class).
            if (!lang) {
              return (
                <code className={className} {...rest}>
                  {children}
                </code>
              );
            }

            // Fenced code with a language — let rehype-highlight do its thing.
            return (
              <code className={className} {...rest}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
      <MarkdownStyles />
    </div>
  );
}

/**
 * Inline styles for markdown content. Kept here so the component is
 * self-contained and the styles can't accidentally leak globally.
 */
function MarkdownStyles(): ReactNode {
  return (
    <style>{`
      .markdown-view {
        color: var(--text);
        font-size: 15px;
        line-height: 1.65;
        max-width: 820px;
      }
      .markdown-view > *:first-child {
        margin-top: 0;
      }
      .markdown-view h1,
      .markdown-view h2,
      .markdown-view h3,
      .markdown-view h4,
      .markdown-view h5,
      .markdown-view h6 {
        font-family: var(--font-sans);
        font-weight: 700;
        letter-spacing: -0.015em;
        color: var(--text);
        line-height: 1.25;
      }
      .markdown-view h1 {
        font-size: 32px;
        margin: 32px 0 20px;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--border);
      }
      .markdown-view h2 {
        font-size: 22px;
        margin: 36px 0 14px;
      }
      .markdown-view h3 {
        font-size: 18px;
        margin: 28px 0 10px;
      }
      .markdown-view h4 {
        font-size: 15px;
        margin: 22px 0 8px;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .markdown-view p {
        margin: 12px 0;
      }
      .markdown-view a {
        color: var(--accent);
        text-decoration: none;
        border-bottom: 1px solid transparent;
        transition: border-color 120ms;
      }
      .markdown-view a:hover {
        border-bottom-color: var(--accent);
      }
      .markdown-view ul,
      .markdown-view ol {
        padding-left: 24px;
        margin: 12px 0;
      }
      .markdown-view li {
        margin: 4px 0;
      }
      .markdown-view code {
        font-family: var(--font-mono);
        font-size: 0.88em;
        background: var(--bg-elevated);
        padding: 2px 6px;
        border-radius: 3px;
        color: var(--accent);
      }
      .markdown-view pre {
        margin: 16px 0;
        padding: 16px 20px;
        background: var(--bg-pane);
        border: 1px solid var(--border);
        overflow-x: auto;
        line-height: 1.5;
      }
      .markdown-view pre code {
        background: none;
        padding: 0;
        color: inherit;
        font-size: 13px;
      }
      .markdown-view blockquote {
        margin: 16px 0;
        padding: 8px 16px;
        border-left: 3px solid var(--border-strong);
        color: var(--text-secondary);
      }
      .markdown-view table {
        width: 100%;
        border-collapse: collapse;
        margin: 16px 0;
        font-size: 13px;
      }
      .markdown-view th,
      .markdown-view td {
        text-align: left;
        padding: 8px 12px;
        border: 1px solid var(--border);
      }
      .markdown-view th {
        background: var(--bg-elevated);
        font-weight: 600;
        font-family: var(--font-mono);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--text-secondary);
      }
      .markdown-view hr {
        margin: 32px 0;
        border: none;
        border-top: 1px solid var(--border);
      }
      .markdown-view strong {
        color: var(--text);
        font-weight: 600;
      }
      /* Mermaid SVG sizing */
      .mermaid-block svg {
        max-width: 100%;
        height: auto;
      }
    `}</style>
  );
}
