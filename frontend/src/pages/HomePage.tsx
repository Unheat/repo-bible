import { useEffect, useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import { MoreVertical, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import type { RepoSummary } from '../../../shared/types/api';

/**
 * Home page. Two areas:
 *   - Top hero with the URL input.
 *   - Below: list of every repo the system already knows about, with
 *     status pills and quick links into each repo's dashboard.
 *
 * Submit flow:
 *   1. POST ingestRepository → repositoryId returned in <500ms.
 *   2. Navigate immediately to /repos/<id>. The dashboard handles the
 *      polling + auto-trigger for generateBible. We don't block the
 *      home page on async work.
 */
export default function HomePage() {
  const [, navigate] = useLocation();
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [repos, setRepos] = useState<RepoSummary[] | null>(null);
  const [reposLoading, setReposLoading] = useState(true);

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Show toast helper
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Initial load + refresh-on-mount. We poll lightly (every 5s) so any
  // repo that's currently processing/generating shows live status.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const res = await api.listRepositories();
        if (!cancelled) {
          setRepos(res.repositories);
          setReposLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('listRepositories failed', err);
          setReposLoading(false);
        }
      }
      if (!cancelled) {
        timer = setTimeout(tick, 5000);
      }
    };
    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!url.trim() || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.ingestRepository({ githubUrl: url.trim() });
      // Hand off to the dashboard, which will poll status and auto-trigger
      // generateBible once ingestion completes.
      navigate(`/repos/${res.repositoryId}?autogenerate=1`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setSubmitting(false);
    }
  };

  const handleDeleteRepo = async (repoId: string, repoName: string) => {
    try {
      await api.deleteRepository({ repositoryId: repoId });
      // Update UI by filtering out the deleted repo
      setRepos((prev) => (prev ? prev.filter((r) => r.id !== repoId) : null));
      showToast(`Successfully deleted ${repoName}`, 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      showToast(`Failed to delete repository: ${message}`, 'error');
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '64px 24px 80px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 720 }}>
        <Hero />
        <form onSubmit={handleSubmit} style={{ marginTop: 32 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="url"
              required
              autoFocus
              placeholder="https://github.com/owner/repo"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={submitting}
              className="input"
              style={{ flex: 1 }}
            />
            <button
              type="submit"
              disabled={submitting || !url.trim()}
              className="btn btn-primary"
              style={{ minWidth: 160 }}
            >
              {submitting ? <Spinner /> : 'Generate Bible →'}
            </button>
          </div>
          {error && (
            <div
              style={{
                marginTop: 12,
                padding: '10px 14px',
                background: 'var(--bg-elevated)',
                borderLeft: '3px solid var(--status-failed)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: 'var(--text-secondary)',
              }}
            >
              {error}
            </div>
          )}
        </form>

        <div
          style={{
            marginTop: 16,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-muted)',
            letterSpacing: '0.02em',
          }}
        >
          Public repos work without configuration. Private repos and PR creation require a GITHUB_TOKEN secret.
        </div>

        <div style={{ marginTop: 64 }}>
          <SectionLabel>Repositories</SectionLabel>
          <RepoList repos={repos} loading={reposLoading} onDelete={handleDeleteRepo} />
        </div>
      </div>

      {/* Toast notification */}
      {toast && (
        <div className={`toast is-${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

function Hero() {
  return (
    <div>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: 'var(--accent)',
          marginBottom: 12,
        }}
      >
        AI-generated onboarding docs
      </div>
      <h1
        style={{
          fontSize: 40,
          fontWeight: 700,
          letterSpacing: '-0.025em',
          lineHeight: 1.1,
          margin: 0,
        }}
      >
        Read any codebase
        <br />
        like you wrote it.
      </h1>
      <p
        style={{
          marginTop: 16,
          fontSize: 16,
          color: 'var(--text-secondary)',
          lineHeight: 1.55,
        }}
      >
        Point Codebase Bible at a GitHub URL. It clones the file tree, embeds the source, and runs two AI agents over the result — a Mapper for the architecture and a Deep-Dive for every file. Open a PR with the result in one click.
      </p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--text-muted)',
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  );
}

function RepoList({
  repos,
  loading,
  onDelete,
}: {
  repos: RepoSummary[] | null;
  loading: boolean;
  onDelete: (repoId: string, repoName: string) => Promise<void>;
}) {
  const [, navigate] = useLocation();
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    await onDelete(deleteConfirm.id, deleteConfirm.name);
    setDeleting(false);
    setDeleteConfirm(null);
    setMenuOpen(null);
  };

  if (loading && !repos) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              height: 68,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              opacity: 0.5,
            }}
          />
        ))}
      </div>
    );
  }

  if (!repos || repos.length === 0) {
    return (
      <div
        style={{
          padding: '32px 0',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--text-muted)',
          letterSpacing: '0.02em',
        }}
      >
        No repositories yet. Drop a URL in the box above to start.
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {repos.map((r) => (
          <div
            key={r.id}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '14px 18px',
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              transition: 'background 120ms, border-color 120ms',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-hover)';
              e.currentTarget.style.borderColor = 'var(--border-strong)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-elevated)';
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
          >
            {/* Main clickable area */}
            <button
              onClick={() => navigate(`/repos/${r.id}`)}
              style={{
                all: 'unset',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                flex: 1,
                minWidth: 0,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--text)',
                  }}
                >
                  {r.repoName}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {r.fileCount} {r.fileCount === 1 ? 'file' : 'files'} ingested
                  {r.documentedFileCount > 0
                    ? ` · ${r.documentedFileCount} documented`
                    : ''}
                  {r.hasOverview ? ' · architecture ready' : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className={`status-pill is-${r.status}`}>ingest {r.status}</span>
                <span className={`status-pill is-${r.docsStatus}`}>
                  docs {r.docsStatus}
                </span>
              </div>
            </button>

            {/* Kebab menu */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(menuOpen === r.id ? null : r.id);
                }}
                className="btn btn-ghost"
                style={{
                  padding: '6px',
                  minWidth: 'auto',
                }}
                title="More options"
              >
                <MoreVertical size={16} />
              </button>

              {/* Dropdown menu */}
              {menuOpen === r.id && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 4,
                    minWidth: 180,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-strong)',
                    zIndex: 100,
                  }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm({ id: r.id, name: r.repoName });
                      setMenuOpen(null);
                    }}
                    style={{
                      all: 'unset',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      padding: '10px 14px',
                      cursor: 'pointer',
                      fontSize: 13,
                      color: 'var(--status-failed)',
                      transition: 'background 120ms',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--bg-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <Trash2 size={14} />
                    Delete Repository
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Confirmation Dialog */}
      {deleteConfirm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => !deleting && setDeleteConfirm(null)}
        >
          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-strong)',
              padding: '24px',
              maxWidth: '480px',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                margin: '0 0 12px 0',
                fontSize: 18,
                fontWeight: 600,
                color: 'var(--text)',
              }}
            >
              Delete Repository
            </h2>
            <p
              style={{
                margin: '0 0 24px 0',
                fontSize: 14,
                lineHeight: 1.6,
                color: 'var(--text-secondary)',
              }}
            >
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong>?
              <br />
              This action cannot be undone. All files, code chunks, and generated documentation will be permanently deleted.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="btn"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="btn"
                style={{
                  background: 'var(--status-failed)',
                  borderColor: 'var(--status-failed)',
                  color: 'white',
                }}
              >
                {deleting ? <Spinner /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Spinner() {
  return <span className="spinner" />;
}
