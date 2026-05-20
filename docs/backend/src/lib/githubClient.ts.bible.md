### 1. File Purpose
This file provides a thin, stateless wrapper around the GitHub REST API and the raw content endpoint, specifically designed for repository ingestion and PR creation workflows. It abstracts HTTP request construction, authentication, error handling, and response parsing for common GitHub operations like fetching repository metadata, file trees, raw file content, and creating Git objects (blobs, trees, commits, branches, and pull requests). Its primary role is to isolate GitHub-specific API interactions from the higher-level business logic in the ingestion and documentation generation services.

### 2. Architecture and Design Patterns
This file implements a **service facade** or **adapter pattern**, providing a simplified, domain-specific interface over the complex GitHub REST API. It does not contain business logic but acts as a low-level client. It fits into the broader layered monolithic architecture as a foundational utility within the `lib/` directory, consumed by services like `ingestRepository.ts` and `openDocumentationPR.ts`. The design is functional, exporting standalone functions rather than a class, promoting statelessness and ease of testing. It uses environment-based configuration (for the GitHub token) and follows a consistent error-handling strategy that surfaces user-friendly messages.

### 3. Public Interface

```typescript
export interface ParsedRepo {
  owner: string;
  name: string;
  canonicalUrl: string;
}
```
- **Purpose**: Represents a parsed and canonicalized GitHub repository reference, used as a unique key for database operations.

```typescript
export function parseGitHubUrl(raw: string): ParsedRepo
```
- **Parameters**: `raw: string` - A GitHub repository URL in various formats (HTTPS, SSH, with or without `.git`, paths, etc.).
- **Returns**: `ParsedRepo` - An object with `owner`, `name`, and `canonicalUrl`.
- **Purpose**: Parses a GitHub URL string into its canonical owner and name components, throwing a clear error for invalid input.

```typescript
export async function githubPost<T>(path: string, body: unknown): Promise<T>
```
- **Parameters**: `path: string` - The GitHub API endpoint path (e.g., `/repos/owner/name/git/blobs`). `body: unknown` - The JSON payload for the POST request.
- **Returns**: `Promise<T>` - The parsed JSON response from the GitHub API.
- **Purpose**: Performs a POST request to the GitHub REST API with authentication and structured error handling.

```typescript
export async function fetchBranchHead(parsed: ParsedRepo, branch: string): Promise<string>
```
- **Parameters**: `parsed: ParsedRepo` - The parsed repository reference. `branch: string` - The branch name.
- **Returns**: `Promise<string>` - The commit SHA at the tip of the specified branch.
- **Purpose**: Fetches the latest commit SHA for a given branch.

```typescript
export async function fetchCommitTreeSha(parsed: ParsedRepo, commitSha: string): Promise<string>
```
- **Parameters**: `parsed: ParsedRepo` - The parsed repository reference. `commitSha: string` - The commit SHA.
- **Returns**: `Promise<string>` - The tree SHA pointed to by the commit.
- **Purpose**: Retrieves the tree SHA associated with a specific commit.

```typescript
export async function createBlob(parsed: ParsedRepo, content: string): Promise<string>
```
- **Parameters**: `parsed: ParsedRepo` - The parsed repository reference. `content: string` - The file content to store as a blob.
- **Returns**: `Promise<string>` - The SHA of the created blob.
- **Purpose**: Creates a new Git blob object containing the provided file content.

```typescript
export async function createTree(parsed: ParsedRepo, baseTreeSha: string, entries: Array<{ path: string; sha: string }>): Promise<string>
```
- **Parameters**: `parsed: ParsedRepo` - The parsed repository reference. `baseTreeSha: string` - The SHA of the base tree to extend. `entries` - An array of file entries (path and blob SHA).
- **Returns**: `Promise<string>` - The SHA of the new tree.
- **Purpose**: Creates a new Git tree by adding or updating files on top of an existing base tree.

```typescript
export async function createCommit(parsed: ParsedRepo, message: string, treeSha: string, parentCommitSha: string): Promise<string>
```
- **Parameters**: `parsed: ParsedRepo` - The parsed repository reference. `message: string` - The commit message. `treeSha: string` - The tree SHA for the commit. `parentCommitSha: string` - The parent commit SHA.
- **Returns**: `Promise<string>` - The SHA of the created commit.
- **Purpose**: Creates a new Git commit with the specified tree and parent.

```typescript
export async function createBranch(parsed: ParsedRepo, branchName: string, commitSha: string): Promise<void>
```
- **Parameters**: `parsed: ParsedRepo` - The parsed repository reference. `branchName: string` - The new branch name. `commitSha: string` - The commit SHA the branch should point to.
- **Returns**: `Promise<void>` - Resolves when the branch is created.
- **Purpose**: Creates a new Git branch pointing to a specific commit. Throws a 422 error if the branch already exists.

```typescript
export async function openPullRequest(parsed: ParsedRepo, args: { title: string; head: string; base: string; body: string }): Promise<{ url: string; number: number }>
```
- **Parameters**: `parsed: ParsedRepo` - The parsed repository reference. `args` - Object containing PR title, head branch, base branch, and body.
- **Returns**: `Promise<{ url: string; number: number }>` - The PR's HTML URL and number.
- **Purpose**: Opens a new pull request on GitHub and returns its details.

```typescript
export interface RepoInfo {
  full_name: string;
  default_branch: string;
}
```
- **Purpose**: Represents core repository metadata returned by the GitHub API.

```typescript
export async function fetchRepoInfo(parsed: ParsedRepo): Promise<RepoInfo>
```
- **Parameters**: `parsed: ParsedRepo` - The parsed repository reference.
- **Returns**: `Promise<RepoInfo>` - Repository metadata including full name and default branch.
- **Purpose**: Fetches basic information about a repository.

```typescript
export interface TreeNode {
  path: string;
  type: 'blob' | 'tree' | 'commit';
  size?: number;
  sha: string;
  mode: string;
}
```
- **Purpose**: Represents a node in a Git tree (file or directory).

```typescript
export interface RepoTree {
  sha: string;
  tree: TreeNode[];
  truncated: boolean;
}
```
- **Purpose**: Represents the full recursive tree of a repository branch, with a flag indicating if GitHub truncated the listing.

```typescript
export async function fetchRepoTree(parsed: ParsedRepo, branch: string): Promise<RepoTree>
```
- **Parameters**: `parsed: ParsedRepo` - The parsed repository reference. `branch: string` - The branch name.
- **Returns**: `Promise<RepoTree>` - The recursive tree structure for the branch.
- **Purpose**: Fetches the complete file tree for a branch, noting if GitHub truncated the response.

```typescript
export async function fetchRawContent(parsed: ParsedRepo, branch: string, path: string): Promise<string>
```
- **Parameters**: `parsed: ParsedRepo` - The parsed repository reference. `branch: string` - The branch name. `path: string` - The file path.
- **Returns**: `Promise<string>` - The raw file content as a UTF-8 string.
- **Purpose**: Fetches the raw text content of a file from `raw.githubusercontent.com`, bypassing the REST API's base64 decoding and size limits.

### 4. Internal Logic Walkthrough

**URL Parsing (`parseGitHubUrl`)**:
The function uses two regular expressions to match common GitHub URL formats. It prioritizes HTTPS/HTTP URLs, then falls back to SSH format. The regex captures the owner and name, stripping any `.git` suffix or additional path components. The canonical URL is constructed consistently for database keying.

```typescript
const httpsMatch = trimmed.match(
  /^https?:\/\/github\.com\/([^/\s]+)\/([^/\s?#]+?)(?:\.git)?(?:[/?#].*)?$/i,
);
const sshMatch = trimmed.match(
  /^git@github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?$/i,
);
```

**Authentication and Headers (`buildHeaders`)**:
This helper constructs the required headers for GitHub API requests. It includes the `Accept`, `X-GitHub-Api-Version`, and `User-Agent` headers. If the `GITHUB_TOKEN` environment variable is set, it adds a Bearer token for authentication; otherwise, requests are unauthenticated (subject to lower rate limits).

```typescript
function buildHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'codebase-bible-ingestor',
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}
```

**Error Handling in `githubFetch`**:
The function checks the HTTP response status. For non-2xx responses, it attempts to read the response body for debugging and throws specific, user-friendly errors for common cases like 404 (not found), 403/429 (rate limit), and a generic error for others. The raw response body is logged to `console.error`.

```typescript
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
```

**POST Request Handling (`githubPost`)**:
Similar to `githubFetch`, but for POST requests. It includes the `Content-Type: application/json` header and stringifies the body. Error handling is more granular, mapping specific status codes (401, 403, 404, 422) to actionable user messages. For 422 errors, it surfaces the response body to help diagnose issues like existing branches or PRs.

```typescript
if (res.status === 422) {
  // 422 from GitHub is "request was understood but rejected" — usually
  // means the branch already exists, or the PR already exists, or the
  // tree was malformed. Surface the body so the caller can reason.
  throw new Error(
    `GitHub rejected the request (422): ${text || 'no body'}.`,
  );
}
```

**Raw Content Fetching (`fetchRawContent`)**:
This function constructs a URL for `raw.githubusercontent.com` and fetches the file content directly. It uses a custom headers object (without the JSON `Accept` header) and includes the Bearer token if available. This approach avoids the base64 decoding and 1 MB size cap of the REST API's contents endpoint.

```typescript
const url = `https://raw.githubusercontent.com/${encodeURIComponent(
  parsed.owner,
)}/${encodeURIComponent(parsed.name)}/${encodeURIComponent(branch)}/${path
  .split('/')
  .map(encodeURIComponent)
  .join('/')}`;

const headers: Record<string, string> = {
  'User-Agent': 'codebase-bible-ingestor',
};
const token = process.env.GITHUB_TOKEN;
if (token) headers.Authorization = `Bearer ${token}`;
```

### 5. Dependencies and Integrations
- **`process.env.GITHUB_TOKEN`**: Environment variable for GitHub authentication. Used in `buildHeaders` and `fetchRawContent`.
- **`fetch` (global)**: Native Node.js 18+ fetch API used for all HTTP requests. No external library is imported for this.
- **Internal Imports**: This file has no internal imports; it is a standalone utility. It is likely imported by services like `ingestRepository.ts` and `openDocumentationPR.ts` (as inferred from the architecture context), but those implementations are not in scope.

### 6. Edge Cases and Error Handling
- **Invalid URL Parsing**: `parseGitHubUrl` throws a clear error if the input doesn't match expected patterns.
- **Authentication Failures**: `githubPost` throws specific errors for 401 (invalid/missing token) and 403 (insufficient permissions).
- **Rate Limiting**: Both `githubFetch` and `githubPost` throw a user-friendly error for 403/429 status codes, suggesting token configuration.
- **Repository Not Found**: `githubFetch` throws a specific error for 404, guiding the user to check URL and visibility.
- **Branch Already Exists**: `createBranch` will throw a 422 error from GitHub, which is surfaced by `githubPost`.
- **Truncated Tree**: `fetchRepoTree` returns a `truncated` flag when GitHub limits the response; the caller must handle this (MVP surfaces it without pagination).
- **Raw Content Errors**: `fetchRawContent` throws a generic error for non-2xx responses, logging the status and path for debugging.

### 7. Observations
- **Code Duplication**: The `createBlob` function is defined twice in the source code (lines ~95-100 and ~105-110). This appears to be a copy-paste error in the provided source.
- **Truncated Source**: The source code block ends with a `[... truncated ...]` marker, but no actual truncation is visible in the provided text. The analysis is based on the complete code shown.
- **Error Message Consistency**: Some error messages in `githubPost` reference "the Secrets tab," which suggests this code is intended for a GitHub Actions or similar environment, but this is not explicitly stated in the file.
- **No Retry Logic**: The file does not implement retry logic for transient failures (e.g., network issues), which may be handled at a higher level.