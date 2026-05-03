/**
 * Thin wrapper around the GitHub REST API for ingestion.
 *
 * Uses native global `fetch` (Node 18+ runtime). Sends `GITHUB_TOKEN` as a
 * Bearer credential when the secret is configured; otherwise falls back to
 * unauthenticated requests (60/hr rate limit, acceptable for the MVP).
 */

const GITHUB_API = 'https://api.github.com';

export interface ParsedRepo {
  owner: string;
  name: string;
  /**
   * Canonicalized URL. Always `https://github.com/{owner}/{name}` — no
   * trailing slash, no `.git`, no `/tree/...` path. Used as the unique
   * key on the `repositories` table.
   */
  canonicalUrl: string;
}

/**
 * Parse a GitHub URL into its owner/name components. Accepts:
 *   - https://github.com/owner/name
 *   - https://github.com/owner/name.git
 *   - https://github.com/owner/name/
 *   - https://github.com/owner/name/tree/branch/...
 *   - https://github.com/owner/name/blob/branch/path
 *   - git@github.com:owner/name(.git)
 *
 * Throws a clear error message if the input does not match.
 */
export function parseGitHubUrl(raw: string): ParsedRepo {
  const trimmed = (raw || '').trim();
  if (!trimmed) {
    throw new Error('A GitHub URL is required.');
  }

  // https / http form
  const httpsMatch = trimmed.match(
    /^https?:\/\/github\.com\/([^/\s]+)\/([^/\s?#]+?)(?:\.git)?(?:[/?#].*)?$/i,
  );
  // git@ ssh form
  const sshMatch = trimmed.match(
    /^git@github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?$/i,
  );

  const match = httpsMatch ?? sshMatch;
  if (!match) {
    throw new Error(
      `"${raw}" does not look like a GitHub repository URL. Expected something like https://github.com/owner/name.`,
    );
  }

  const owner = match[1];
  const name = match[2];
  return {
    owner,
    name,
    canonicalUrl: `https://github.com/${owner}/${name}`,
  };
}

function buildHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    // GitHub requires a User-Agent on every API request.
    'User-Agent': 'codebase-bible-ingestor',
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Call the GitHub REST API and return parsed JSON. Surfaces a clear,
 * user-friendly error message on non-2xx responses. The raw response
 * body (when text) is logged via `console.error` for debugging.
 */
async function githubFetch<T>(path: string): Promise<T> {
  const url = `${GITHUB_API}${path}`;
  const res = await fetch(url, { headers: buildHeaders() });

  if (!res.ok) {
    let body = '';
    try {
      body = await res.text();
    } catch {
      // ignore
    }
    console.error(`GitHub API ${res.status} on ${path}: ${body}`);

    if (res.status === 404) {
      throw new Error(
        'Repository not found. Make sure the URL is correct and the repository is public (or that GITHUB_TOKEN is configured for private access).',
      );
    }
    if (res.status === 403 || res.status === 429) {
      throw new Error(
        'GitHub API rate limit reached. Configure a GITHUB_TOKEN secret to raise the limit, then try again.',
      );
    }
    throw new Error(
      `GitHub API request failed (${res.status}). Check the logs for details.`,
    );
  }

  return (await res.json()) as T;
}

/**
 * POST to the GitHub REST API with a JSON body. Used by the PR opener
 * for blob/tree/commit/ref/pulls creation. Throws clear errors on the
 * specific status codes that map to "user-fixable" failures (auth, not
 * found, validation), and a generic message for everything else.
 */
export async function githubPost<T>(
  path: string,
  body: unknown,
): Promise<T> {
  const url = `${GITHUB_API}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...buildHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let text = '';
    try {
      text = await res.text();
    } catch {
      // ignore
    }
    console.error(`GitHub API POST ${res.status} on ${path}: ${text}`);

    if (res.status === 401) {
      throw new Error(
        'GitHub authentication failed. The GITHUB_TOKEN secret is missing, expired, or invalid. Set a valid token in the Secrets tab and try again.',
      );
    }
    if (res.status === 403) {
      throw new Error(
        'GitHub denied the request. The configured GITHUB_TOKEN does not have write access to this repository. Use a token that owns or maintains the repo, or fork it first.',
      );
    }
    if (res.status === 404) {
      throw new Error(
        'GitHub said this repository does not exist (or your token cannot see it). Check that the GITHUB_TOKEN has access.',
      );
    }
    if (res.status === 422) {
      // 422 from GitHub is "request was understood but rejected" — usually
      // means the branch already exists, or the PR already exists, or the
      // tree was malformed. Surface the body so the caller can reason.
      throw new Error(
        `GitHub rejected the request (422): ${text || 'no body'}.`,
      );
    }
    throw new Error(
      `GitHub POST failed (${res.status}). Check the logs for details.`,
    );
  }
  return (await res.json()) as T;
}

// ─── Git Data API helpers (used by openDocumentationPR) ─────────────

interface GitRef {
  ref: string;
  object: { sha: string; type: string };
}

interface GitCommitResponse {
  sha: string;
  tree: { sha: string };
}

interface GitBlobResponse {
  sha: string;
}

interface GitTreeResponse {
  sha: string;
}

interface GitCommitCreateResponse {
  sha: string;
}

interface PullRequestResponse {
  html_url: string;
  number: number;
}

/** Get the commit SHA at the tip of a branch. */
export async function fetchBranchHead(
  parsed: ParsedRepo,
  branch: string,
): Promise<string> {
  const ref = await githubFetch<GitRef>(
    `/repos/${parsed.owner}/${parsed.name}/git/ref/heads/${encodeURIComponent(branch)}`,
  );
  return ref.object.sha;
}

/** Get the tree SHA pointed at by a commit. */
export async function fetchCommitTreeSha(
  parsed: ParsedRepo,
  commitSha: string,
): Promise<string> {
  const commit = await githubFetch<GitCommitResponse>(
    `/repos/${parsed.owner}/${parsed.name}/git/commits/${commitSha}`,
  );
  return commit.tree.sha;
}

/**
 * Create a single blob (file content) and return its SHA. Used as the
 * leaf step before assembling a tree.
 */
export async function createBlob(
  parsed: ParsedRepo,
  content: string,
): Promise<string> {
  const blob = await githubPost<GitBlobResponse>(
    `/repos/${parsed.owner}/${parsed.name}/git/blobs`,
    { content, encoding: 'utf-8' },
  );
  return blob.sha;
}

/**
 * Create a new tree on top of `baseTreeSha` containing the supplied
 * blob entries. Returns the new tree SHA.
 */
export async function createTree(
  parsed: ParsedRepo,
  baseTreeSha: string,
  entries: Array<{ path: string; sha: string }>,
): Promise<string> {
  const tree = await githubPost<GitTreeResponse>(
    `/repos/${parsed.owner}/${parsed.name}/git/trees`,
    {
      base_tree: baseTreeSha,
      tree: entries.map((e) => ({
        path: e.path,
        mode: '100644', // regular file
        type: 'blob',
        sha: e.sha,
      })),
    },
  );
  return tree.sha;
}

/** Create a commit pointing at the given tree, parented to the given commit. */
export async function createCommit(
  parsed: ParsedRepo,
  message: string,
  treeSha: string,
  parentCommitSha: string,
): Promise<string> {
  const commit = await githubPost<GitCommitCreateResponse>(
    `/repos/${parsed.owner}/${parsed.name}/git/commits`,
    {
      message,
      tree: treeSha,
      parents: [parentCommitSha],
    },
  );
  return commit.sha;
}

/** Create a new branch pointing at the given commit. Throws 422 if the branch already exists. */
export async function createBranch(
  parsed: ParsedRepo,
  branchName: string,
  commitSha: string,
): Promise<void> {
  await githubPost(
    `/repos/${parsed.owner}/${parsed.name}/git/refs`,
    {
      ref: `refs/heads/${branchName}`,
      sha: commitSha,
    },
  );
}

/** Open a pull request and return the URL + number. */
export async function openPullRequest(
  parsed: ParsedRepo,
  args: { title: string; head: string; base: string; body: string },
): Promise<{ url: string; number: number }> {
  const pr = await githubPost<PullRequestResponse>(
    `/repos/${parsed.owner}/${parsed.name}/pulls`,
    args,
  );
  return { url: pr.html_url, number: pr.number };
}

export interface RepoInfo {
  full_name: string;
  default_branch: string;
}

export async function fetchRepoInfo(parsed: ParsedRepo): Promise<RepoInfo> {
  return githubFetch<RepoInfo>(
    `/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.name)}`,
  );
}

export interface TreeNode {
  path: string;
  type: 'blob' | 'tree' | 'commit';
  size?: number;
  sha: string;
  mode: string;
}

export interface RepoTree {
  sha: string;
  tree: TreeNode[];
  /** True when GitHub truncated the listing (over ~100k entries / ~7 MB). */
  truncated: boolean;
}

/**
 * Fetch the recursive file tree for a branch. Note: GitHub truncates above
 * roughly 100k entries or 7 MB of metadata. The MVP surfaces `truncated`
 * back to the caller without paginating; full tree walk is out of scope.
 */
export async function fetchRepoTree(
  parsed: ParsedRepo,
  branch: string,
): Promise<RepoTree> {
  return githubFetch<RepoTree>(
    `/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(
      parsed.name,
    )}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
  );
}

/**
 * Fetch raw text content for a single file at the given branch.
 *
 * Uses `raw.githubusercontent.com` rather than the REST contents endpoint
 * to skip base64 decoding and the 1 MB API cap. Sends the same Bearer
 * token (when configured) so private repos work.
 *
 * Returns the file body as a UTF-8 string. Throws a friendly error on
 * non-2xx responses; callers decide whether to surface or swallow it.
 */
export async function fetchRawContent(
  parsed: ParsedRepo,
  branch: string,
  path: string,
): Promise<string> {
  const url = `https://raw.githubusercontent.com/${encodeURIComponent(
    parsed.owner,
  )}/${encodeURIComponent(parsed.name)}/${encodeURIComponent(branch)}/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;

  // Strip JSON Accept header — raw endpoint returns plain text, not JSON.
  const headers: Record<string, string> = {
    'User-Agent': 'codebase-bible-ingestor',
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    let body = '';
    try {
      body = await res.text();
    } catch {
      // ignore
    }
    console.error(`raw.githubusercontent ${res.status} on ${path}: ${body}`);
    throw new Error(
      `Failed to fetch raw content for ${path} (HTTP ${res.status}).`,
    );
  }

  return await res.text();
}
