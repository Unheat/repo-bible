/**
 * Repository dashboard. Three states the page transitions through:
 *
 *   1. INGESTING   — `repo.status === 'processing'`. Polling.
 *                    On `'completed'`, if `?autogenerate=1` is in the URL
 *                    AND `docsStatus === 'idle'`, fire generateBible
 *                    automatically (then drop the query param).
 *
 *   2. GENERATING  — `repo.docsStatus === 'generating'`. Polling.
 *                    A skeleton tree + progress message.
 *
 *   3. READY       — both completed. Full dashboard: file tree (left),
 *                    markdown reader (right), "Push to GitHub" (top-right).
 *
 * Failures (`status === 'failed'` or `docsStatus === 'failed'`) surface
 * inline with a short message and a back-to-home link.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useRoute, Link } from 'wouter';
// TODO: Replace with REST API client from '../api/client'
// import { api } from '../api/client';
import type { RepositoryDetail, FileSummary } from '../../../shared/types/api';
import MarkdownView from '../components/MarkdownView';

// Temporary placeholder until REST API client is implemented
const api = {
  getRepositoryDetail: async (_input: any) => { throw new Error('API client not implemented'); },
  generateBible: async (_input: any) => { throw new Error('API client not implemented'); },
  openDocumentationPR: async (_input: any) => { throw new Error('API client not implemented'); },
} as any;

const POLL_INTERVAL_MS = 3000;

export default function RepoPage() {
  const [match, params] = useRoute<{ id: string }>('/repos/:id');
  const [location, navigate] = useLocation();
  const repositoryId = params?.id ?? '';
  const autogenerateRequested = useMemo(
    () => new URLSearchParams(location.split('?')[1] ?? '').get('autogenerate') === '1',
    [location],
  );
  const [autogenerateConsumed, setAutogenerateConsumed] = useState(false);

  const [detail, setDetail] = useState<RepositoryDetail | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  // Dashboard view-mode: the architecture overview, or one file's writeup.
  type View = { kind: 'overview' } | { kind: 'file'; fileId: string };
  const [view, setView] = useState<View>({ kind: 'overview' });

  // Toast for PR-create feedback.
  const [toast, setToast] = useState<{
    kind: 'success' | 'error';
    message: string;
    href?: string;
  } | null>(null);

  // Auto-dismiss toasts after 8s. Also let the user close them early
  // with Escape — long PR-creation toasts in particular feel sticky
  // without an explicit way to clear them.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 8000);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setToast(null);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [toast]);

  // Poll for repo detail. Stops polling when both status and docsStatus
  // are in terminal states.
  useEffect(() => {
    if (!repositoryId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const next = await api.getRepositoryDetail({ repositoryId });
        if (cancelled) return;
        setDetail(next);
        setPollError(null);

        const ingestTerminal =
          next.status === 'completed' || next.status === 'failed';
        const docsTerminal =
          next.docsStatus === 'completed' || next.docsStatus === 'failed';

        if (ingestTerminal && docsTerminal) return; // stop polling
        timer = setTimeout(tick, POLL_INTERVAL_MS);
      } catch (err: unknown) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setPollError(message);
        timer = setTimeout(tick, POLL_INTERVAL_MS);
      }
    };
    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [repositoryId]);

  // Auto-trigger generateBible once ingestion completes, if the home
  // page asked for it. Strips the query param after firing so a manual
  // page reload doesn't re-fire.
  useEffect(() => {
    if (!detail || autogenerateConsumed) return;
    if (!autogenerateRequested) return;
    if (detail.status !== 'completed') return;
    if (detail.docsStatus !== 'idle') return;
    setAutogenerateConsumed(true);
    api
      .generateBible({ repositoryId })
      .catch((err) => {
        console.error('generateBible failed', err);
        setToast({
          kind: 'error',
          message:
            err instanceof Error
              ? err.message
              : 'Failed to start documentation generation.',
        });
      })
      .finally(() => {
        // Strip ?autogenerate=1 from the URL.
        navigate(`/repos/${repositoryId}`, { replace: true });
      });
  }, [
    detail,
    autogenerateRequested,
    autogenerateConsumed,
    repositoryId,
    navigate,
  ]);

  if (!match) return null;
  if (!detail && !pollError) {
    return <FullScreenStatus title="Loading…" subtitle={null} />;
  }
  if (!detail && pollError) {
    return (
      <FullScreenStatus
        title="Could not load repository"
        subtitle={pollError}
        showHome
      />
    );
  }
  if (!detail) return null;

  // Routing decisions per current state.
  if (detail.status === 'failed') {
    return (
      <FullScreenStatus
        title="Ingestion failed"
        subtitle={`${detail.repoName} could not be ingested. Check the method logs for details.`}
        showHome
        busy={false}
      />
    );
  }
  if (detail.status === 'processing') {
    return (
      <FullScreenStatus
        title={`Ingesting ${detail.repoName}…`}
        subtitle="Fetching file tree, chunking source, generating embeddings. Usually under a minute for small repos, a few minutes for large ones."
      />
    );
  }
  if (detail.docsStatus === 'generating' || detail.docsStatus === 'idle') {
    const filesShown = detail.docsStatus === 'generating' ? detail.files.length : 0;
    return (
      <FullScreenStatus
        title={
          detail.docsStatus === 'generating'
            ? `Generating bible for ${detail.repoName}…`
            : `Ready to generate documentation`
        }
        subtitle={
          detail.docsStatus === 'generating'
            ? `Mapper agent (architecture) → Deep-Dive agent (per file). ${detail.files.length} files in scope. Streaming in.`
            : `Click "Generate Bible" to produce documentation for ${detail.files.length} files.`
        }
        showSecondary={detail.docsStatus === 'idle'}
        secondaryLabel="Generate Bible"
        onSecondary={async () => {
          try {
            await api.generateBible({ repositoryId });
          } catch (err: unknown) {
            setToast({
              kind: 'error',
              message:
                err instanceof Error
                  ? err.message
                  : 'Failed to start documentation generation.',
            });
          }
        }}
        progressFiles={filesShown}
      />
    );
  }
  if (detail.docsStatus === 'failed') {
    return (
      <FullScreenStatus
        title="Documentation generation failed"
        subtitle={`Generation crashed midway. Check method logs for details. You can try again.`}
        showHome
        busy={false}
        showSecondary
        secondaryLabel="Retry"
        onSecondary={async () => {
          try {
            await api.generateBible({ repositoryId });
          } catch (err: unknown) {
            setToast({
              kind: 'error',
              message:
                err instanceof Error
                  ? err.message
                  : 'Failed to start documentation generation.',
            });
          }
        }}
      />
    );
  }

  // Both completed → full dashboard.
  return (
    <div
      style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '320px 1fr',
        gridTemplateRows: '56px 1fr',
        gridTemplateAreas: '"toolbar toolbar" "sidebar reader"',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <Toolbar
        detail={detail}
        repositoryId={repositoryId}
        onPrCreated={(url, number) =>
          setToast({
            kind: 'success',
            message: `Pull request #${number} opened.`,
            href: url,
          })
        }
        onPrError={(message) => setToast({ kind: 'error', message })}
      />
      <Sidebar
        detail={detail}
        view={view}
        onSelectOverview={() => setView({ kind: 'overview' })}
        onSelectFile={(f) => {
          setSelectedFileId(f.id);
          setView({ kind: 'file', fileId: f.id });
        }}
        selectedFileId={selectedFileId}
      />
      <Reader detail={detail} view={view} />

      {toast && (
        <div
          className={`toast is-${toast.kind}`}
          role="status"
          aria-live="polite"
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div>{toast.message}</div>
              {toast.href && (
                <a
                  href={toast.href}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    color: 'var(--accent)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    marginTop: 4,
                    display: 'inline-block',
                    wordBreak: 'break-all',
                  }}
                >
                  {toast.href}
                </a>
              )}
            </div>
            <button
              onClick={() => setToast(null)}
              aria-label="Dismiss"
              style={{
                all: 'unset',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                fontSize: 14,
                lineHeight: 1,
                padding: '2px 4px',
                marginTop: -2,
                transition: 'color 120ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--text)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Toolbar ────────────────────────────────────────────────────────

function Toolbar({
  detail,
  repositoryId,
  onPrCreated,
  onPrError,
}: {
  detail: RepositoryDetail;
  repositoryId: string;
  onPrCreated: (url: string, number: number) => void;
  onPrError: (message: string) => void;
}) {
  const [pushing, setPushing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const handlePush = async () => {
    if (pushing) return;
    setPushing(true);
    try {
      const res = await api.openDocumentationPR({ repositoryId });
      onPrCreated(res.prUrl, res.prNumber);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      onPrError(message);
    } finally {
      setPushing(false);
    }
  };

  const handleRegenerate = async () => {
    if (regenerating) return;
    setRegenerating(true);
    try {
      await api.generateBible({ repositoryId });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      onPrError(message);
    } finally {
      // Polling in the parent will pick up docsStatus='generating' and
      // route us back to the loading view automatically.
      setRegenerating(false);
    }
  };

  return (
    <div
      style={{
        gridArea: 'toolbar',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-elevated)',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
        <Link
          href="/"
          style={{
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            textDecoration: 'none',
          }}
        >
          ← all repos
        </Link>
        <div
          style={{
            width: 1,
            height: 24,
            background: 'var(--border)',
          }}
        />
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {detail.repoName}
        </div>
        <a
          href={detail.githubUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            color: 'var(--text-muted)',
            fontSize: 12,
            textDecoration: 'none',
            fontFamily: 'var(--font-mono)',
          }}
        >
          ↗ source
        </a>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          className="btn btn-ghost"
          onClick={handleRegenerate}
          disabled={regenerating}
          title="Re-run Mapper + Deep-Dive agents"
        >
          {regenerating ? <span className="spinner" /> : 'Regenerate'}
        </button>
        <button
          className="btn btn-primary"
          onClick={handlePush}
          disabled={pushing}
        >
          {pushing ? <span className="spinner" /> : 'Push to GitHub →'}
        </button>
      </div>
    </div>
  );
}

// ─── Sidebar (file tree) ────────────────────────────────────────────

type View = { kind: 'overview' } | { kind: 'file'; fileId: string };

function Sidebar({
  detail,
  view,
  onSelectOverview,
  onSelectFile,
}: {
  detail: RepositoryDetail;
  view: View;
  onSelectOverview: () => void;
  onSelectFile: (f: FileSummary) => void;
  selectedFileId: string | null;
}) {
  return (
    <aside
      style={{
        gridArea: 'sidebar',
        borderRight: '1px solid var(--border)',
        background: 'var(--bg-pane)',
        overflowY: 'auto',
        padding: '16px 0',
      }}
    >
      <div style={{ padding: '0 16px 12px', userSelect: 'none' }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'var(--text-muted)',
            marginBottom: 6,
          }}
        >
          Overview
        </div>
        <FileRow
          label="Architecture"
          subtitle={detail.overview ? 'Mermaid + summary' : 'Not generated'}
          active={view.kind === 'overview'}
          disabled={!detail.overview}
          onClick={onSelectOverview}
        />
      </div>
      <div style={{ padding: '0 16px' }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'var(--text-muted)',
            margin: '8px 0 6px',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>Files</span>
          <span>{detail.files.length}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {detail.files.map((f) => {
            const active = view.kind === 'file' && view.fileId === f.id;
            return (
              <FileRow
                key={f.id}
                label={f.filePath}
                subtitle={f.language}
                active={active}
                disabled={!f.hasDoc}
                onClick={() => f.hasDoc && onSelectFile(f)}
              />
            );
          })}
        </div>
      </div>
    </aside>
  );
}

function FileRow({
  label,
  subtitle,
  active,
  disabled,
  onClick,
}: {
  label: string;
  subtitle?: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        all: 'unset',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: '6px 10px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: active ? 'var(--bg-active)' : 'transparent',
        borderLeft: active
          ? '2px solid var(--accent)'
          : '2px solid transparent',
        color: disabled
          ? 'var(--text-muted)'
          : active
            ? 'var(--text)'
            : 'var(--text-secondary)',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        opacity: disabled ? 0.5 : 1,
        transition: 'background 80ms',
      }}
      onMouseEnter={(e) => {
        if (!disabled && !active) {
          e.currentTarget.style.background = 'var(--bg-hover)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'transparent';
        }
      }}
    >
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '100%',
        }}
        title={label}
      >
        {label}
      </span>
      {subtitle && (
        <span
          style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {subtitle}
        </span>
      )}
    </button>
  );
}

// ─── Reader ─────────────────────────────────────────────────────────

function Reader({ detail, view }: { detail: RepositoryDetail; view: View }) {
  const content = (() => {
    if (view.kind === 'overview') return detail.overview?.markdownContent ?? '';
    const doc = detail.fileDocsByFileId[view.fileId];
    return doc?.markdownContent ?? '';
  })();

  // Reset scroll to top whenever the user picks a different doc, and
  // run a brief opacity fade so the swap feels intentional rather than
  // snappy. Keyed off the view kind + file id so overview→file and
  // file→file both trigger the transition.
  const viewKey = view.kind === 'overview' ? 'overview' : `file:${view.fileId}`;
  const sectionRef = useRef<HTMLElement | null>(null);
  const [fadeIn, setFadeIn] = useState(true);
  useEffect(() => {
    if (sectionRef.current) sectionRef.current.scrollTop = 0;
    setFadeIn(false);
    const t = window.setTimeout(() => setFadeIn(true), 16);
    return () => window.clearTimeout(t);
  }, [viewKey]);

  const meta = (() => {
    if (view.kind === 'overview') {
      return detail.overview
        ? `Generated ${formatRelative(detail.overview.createdAt)}`
        : '';
    }
    const file = detail.files.find((f) => f.id === view.fileId);
    const doc = detail.fileDocsByFileId[view.fileId];
    if (!file || !doc) return '';
    return `${file.filePath} · ${file.language} · Generated ${formatRelative(doc.createdAt)}`;
  })();

  return (
    <section
      ref={sectionRef}
      style={{
        gridArea: 'reader',
        overflowY: 'auto',
        padding: '40px 56px 80px',
        background: 'var(--bg)',
        opacity: fadeIn ? 1 : 0,
        transition: 'opacity 160ms ease-out',
      }}
    >
      {meta && (
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-muted)',
            marginBottom: 16,
          }}
        >
          {meta}
        </div>
      )}
      {content ? (
        <MarkdownView content={content} />
      ) : (
        <div
          style={{
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            padding: '64px 0',
          }}
        >
          No documentation available for this selection.
        </div>
      )}
    </section>
  );
}

// ─── Full-screen status (loading / error / waiting) ────────────────

function FullScreenStatus({
  title,
  subtitle,
  showHome,
  showSecondary,
  secondaryLabel,
  onSecondary,
  progressFiles,
  busy = true,
}: {
  title: string;
  subtitle: string | null;
  showHome?: boolean;
  showSecondary?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void | Promise<void>;
  progressFiles?: number;
  /**
   * Whether this status represents in-flight work (ingesting, generating).
   * When true, render a small mint pulse beneath the eyebrow so the user
   * has a visible "something is happening" signal during the long polls.
   * Defaults to true; explicit `false` for terminal error states.
   */
  busy?: boolean;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 520,
          textAlign: 'center',
          // Brief fade-up entrance the first time this view mounts so the
          // transition from the loading spinner into the message feels
          // settled rather than abrupt.
          animation: 'fadeInUp 240ms ease-out',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'var(--accent)',
            marginBottom: 12,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {busy && (
            <span
              aria-hidden="true"
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--accent)',
                animation: 'pulse 1.4s ease-in-out infinite',
              }}
            />
          )}
          Codebase Bible
        </div>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            margin: 0,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              marginTop: 12,
              color: 'var(--text-secondary)',
              fontSize: 14,
              lineHeight: 1.55,
            }}
          >
            {subtitle}
          </p>
        )}
        {typeof progressFiles === 'number' && progressFiles > 0 && (
          <div
            style={{
              marginTop: 24,
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--text-muted)',
            }}
          >
            {progressFiles} {progressFiles === 1 ? 'file' : 'files'} queued
          </div>
        )}
        <div
          style={{
            marginTop: 32,
            display: 'flex',
            gap: 8,
            justifyContent: 'center',
          }}
        >
          {showHome && (
            <Link
              href="/"
              style={{
                color: 'var(--text)',
                textDecoration: 'none',
                fontFamily: 'var(--font-sans)',
                fontSize: 13,
                fontWeight: 500,
              }}
              className="btn"
            >
              Back home
            </Link>
          )}
          {showSecondary && secondaryLabel && onSecondary && (
            <button
              className="btn btn-primary"
              onClick={() => {
                void onSecondary();
              }}
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function formatRelative(unixMs: number): string {
  const diffMs = Date.now() - unixMs;
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}
