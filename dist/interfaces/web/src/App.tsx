import { Route, Switch, Link } from 'wouter';
import HomePage from './pages/HomePage';
import RepoPage from './pages/RepoPage';

export default function App() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <TopBar />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/repos/:id" component={RepoPage} />
          <Route>
            <NotFound />
          </Route>
        </Switch>
      </main>
    </div>
  );
}

function TopBar() {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 24px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg)',
        userSelect: 'none',
      }}
    >
      <Link
        href="/"
        style={{
          color: 'var(--text)',
          textDecoration: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontFamily: 'var(--font-mono)',
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: '-0.01em',
        }}
      >
        <span style={{ color: 'var(--accent)' }}>{'^'}</span>
        codebase-bible
      </Link>
      <a
        href="https://github.com"
        target="_blank"
        rel="noreferrer"
        style={{
          color: 'var(--text-muted)',
          fontSize: 12,
          textDecoration: 'none',
          fontFamily: 'var(--font-mono)',
        }}
      >
        AI-generated docs for any GitHub repo
      </a>
    </header>
  );
}

function NotFound() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
      }}
    >
      404 — page not found
    </div>
  );
}
