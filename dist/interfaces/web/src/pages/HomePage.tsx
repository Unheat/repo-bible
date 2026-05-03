import { useEffect, useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import { api, type RepoSummary } from '../api';

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
          <RepoList repos={repos} loading={reposLoading} />
        </div>
      </div>
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
}: {
  repos: RepoSummary[] | null;
  loading: boolean;
}) {
  const [, navigate] = useLocation();

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {repos.map((r) => (
        <button
          key={r.id}
          onClick={() => navigate(`/repos/${r.id}`)}
          style={{
            all: 'unset',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
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
      ))}
    </div>
  );
}

function Spinner() {
  return <span className="spinner" />;
}
