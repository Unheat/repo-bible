### 1. File Purpose
This file implements the `openDocumentationPR` service, which is the final step in the documentation generation pipeline. It publishes the generated documentation (an "architecture overview" and per-file writeups) as a Pull Request on the source repository. The service validates the repository's state, collects the latest generated documentation from the database, materializes it as a set of markdown files in a `docs/` directory, and uses the GitHub Git Data API to create a new branch, commit the files, and open a PR against the repository's default branch.

### 2. Architecture and Design Patterns
This file follows a **service-layer pattern** within the backend's layered monolithic architecture. It encapsulates a complex, multi-step business process (opening a documentation PR) that involves database queries, external API calls (GitHub), and concurrent operations. It acts as a controller for the GitHub Git Data API, orchestrating a sequence of operations: fetch base commit, create blobs, create tree, create commit, create branch, and open PR. It is a key component in the event-driven ingestion pipeline, triggered after documentation generation is complete.

### 3. Public Interface

```typescript
export async function openDocumentationPR(
  input: OpenDocumentationPRInput,
): Promise<OpenDocumentationPROutput>
```

**Parameters:**
- `input: OpenDocumentationPRInput`
  - `repositoryId: string`: The ID of the repository for which to open a PR. The repository must have `docsStatus === 'completed'`.

**Return Type:** `Promise<OpenDocumentationPROutput>`
- `prUrl: string`: The URL of the opened Pull Request.
- `prNumber: number`: The number of the opened Pull Request.
- `branch: string`: The name of the new branch created for the PR.
- `fileCount: number`: The number of markdown files committed in the PR.

**Purpose:** Validates the repository's documentation status, collects the latest generated docs, creates a new Git branch with the documentation files, and opens a Pull Request on the source repository.

### 4. Internal Logic Walkthrough

The function executes a sequential pipeline with several key steps:

1.  **Validation and Setup:**
    - It first fetches the repository from the database and validates that `docsStatus` is `'completed'`. It also checks for the required `GITHUB_TOKEN` environment variable.
    - It parses the repository's GitHub URL and re-fetches its metadata to get the current default branch name, ensuring the PR is opened against the live branch.

    ```typescript
    const repo = await prisma.repository.findUnique({
      where: { id: input.repositoryId },
    });

    if (!repo) throw new Error('Repository not found.');
    if (repo.docsStatus !== 'completed') {
      throw new Error(
        `Documentation generation has not completed for this repository (docsStatus="${repo.docsStatus ?? 'idle'}"). Run Generate Bible and wait for it to finish before opening a PR.`,
      );
    }

    // GITHUB_TOKEN is REQUIRED for write operations. If absent, fail fast
    // with a useful message instead of getting a 401 from GitHub.
    if (!process.env.GITHUB_TOKEN) {
      throw new Error(
        'GITHUB_TOKEN is not configured. Set it in the Secrets tab with a token that has contents:write and pull_requests:write permissions on the target repository.',
      );
    }

    const parsed = parseGitHubUrl(repo.githubUrl);

    // Re-fetch repo metadata to learn the live default branch (might have
    // changed since ingestion). The PR is opened against this branch.
    const repoInfo = await fetchRepoInfo(parsed);
    const defaultBranch = repoInfo.default_branch;
    ```

2.  **Collect Latest Documentation:**
    - It queries the database for all files and generated documents associated with the repository.
    - It then iterates through the documents to select the single latest `repo_overview` and the latest `file_deepdive` for each file ID, based on `createdAt`. This ensures the PR contains only the most recent documentation, avoiding pollution from prior runs.

    ```typescript
    // Keyed selection: latest `repo_overview` by created_at, latest
    // `file_deepdive` per fileId by created_at.
    let latestOverview: { markdownContent: string; createdAt: number } | null = null;
    const latestByFileId = new Map<string, { markdownContent: string; createdAt: number }>();
    for (const d of allDocs) {
      const createdAtMs = d.createdAt.getTime();
      if (d.docType === 'repo_overview') {
        if (!latestOverview || createdAtMs > latestOverview.createdAt) {
          latestOverview = {
            markdownContent: d.markdownContent,
            createdAt: createdAtMs,
          };
        }
      } else if (d.docType === 'file_deepdive' && d.fileId) {
        const existing = latestByFileId.get(d.fileId);
        if (!existing || createdAtMs > existing.createdAt) {
          latestByFileId.set(d.fileId, {
            markdownContent: d.markdownContent,
            createdAt: createdAtMs,
          });
        }
      }
    }
    ```

3.  **Materialize Path-to-Content Map:**
    - It constructs a flat map of file paths to markdown content. The architecture overview is placed at `docs/ARCHITECTURE.md`, and each file's deep-dive is placed at `docs/<original-path>.bible.md`. The `.bible.md` suffix prevents collisions with existing files and signals the content is AI-generated.

    ```typescript
    const filesByPath: Record<string, string> = {};
    if (latestOverview) {
      filesByPath['docs/ARCHITECTURE.md'] = latestOverview.markdownContent;
    }
    for (const file of files) {
      const doc = latestByFileId.get(file.id);
      if (doc) {
        filesByPath[`docs/${file.filePath}.bible.md`] = doc.markdownContent;
      }
    }
    ```

4.  **GitHub Git Data API Orchestration:**
    - **(a) + (b):** It fetches the HEAD commit SHA and the corresponding tree SHA of the default branch.
    - **(c) Create Blobs Concurrently:** It creates a Git blob for each markdown file. To optimize performance and avoid rate limits, it uses a concurrency pool of 8 (`BLOB_CONCURRENCY`). The implementation uses a manual promise-based pool with a `while` loop and `inFlight` counter.

    ```typescript
    // (c) Create blobs concurrently.
    const pathContentEntries = Object.entries(filesByPath);
    const blobEntries: Array<{ path: string; sha: string }> = [];
    let inFlight = 0;
    let cursor = 0;
    await new Promise<void>((resolve, reject) => {
      let firstError: unknown = null;
      const dispatch = () => {
        if (firstError) return; // stop fanning out on first error
        while (inFlight < BLOB_CONCURRENCY && cursor < pathContentEntries.length) {
          const idx = cursor++;
          const [path, content] = pathContentEntries[idx];
          inFlight++;
          createBlob(parsed, content)
            .then((sha) => blobEntries.push({ path, sha }))
            .catch((err) => {
              if (!firstError) firstError = err;
            })
            .finally(() => {
              inFlight--;
              if (firstError && inFlight === 0) reject(firstError);
              else if (cursor === pathContentEntries.length && inFlight === 0) resolve();
              else dispatch();
            });
        }
      };
      dispatch();
    });
    ```
    - **(d) Create Tree:** It creates a new Git tree based on the base tree, including all the newly created file blobs.
    - **(e) Create Commit:** It creates a new commit that points to the new tree, with the base commit as its parent.
    - **(f) Create Branch:** It creates a new branch reference with a unique, millisecond-stamped name (`codebase-bible-<unix-ms>`) to avoid collisions between multiple runs.
    - **(g) Open PR:** It composes a PR body using `buildPrBody` and opens a Pull Request from the new branch to the default branch.

    ```typescript
    // (f) Create branch. Millisecond suffix avoids collisions with prior runs.
    const branchName = `codebase-bible-${Date.now()}`;
    await createBranch(parsed, branchName, newCommitSha);

    // (g) Open PR.
    const prBody = buildPrBody({
      repoName: repo.repoName,
      fileCount: blobEntries.length,
      hasOverview: !!latestOverview,
    });
    const pr = await openPullRequest(parsed, {
      title: 'docs: Auto-Generated Codebase Bible',
      head: branchName,
      base: defaultBranch,
      body: prBody,
    });
    ```

5.  **Return Result:** The function returns the PR URL, number, branch name, and file count.

### 5. Dependencies and Integrations

**Internal Imports:**
- `prisma` from `'../db/prisma.js'`: The Prisma ORM client for database access. Used to query `repository`, `file`, and `generatedDoc` tables.
- `parseGitHubUrl`, `fetchRepoInfo`, `fetchBranchHead`, `fetchCommitTreeSha`, `createBlob`, `createTree`, `createCommit`, `createBranch`, `openPullRequest` from `'../lib/githubClient'`: A collection of functions that wrap the GitHub API. This file orchestrates them to perform the Git data operations required to create a PR.

**External Dependencies:**
- `process.env.GITHUB_TOKEN`: Environment variable containing a GitHub personal access token with `contents:write` and `pull_requests:write` permissions. It is required for all write operations to the target repository.

### 6. Edge Cases and Error Handling

- **Repository Not Found:** Throws an error if the `repositoryId` does not exist in the database.
- **Invalid Documentation Status:** Throws a descriptive error if `repo.docsStatus` is not `'completed'`, instructing the user to run the Generate Bible step first.
- **Missing GITHUB_TOKEN:** Throws an error before making any GitHub API calls if the `GITHUB_TOKEN` environment variable is not set, providing a clear message about required permissions.
- **No Documentation Rows:** Throws an error if, after querying, no documentation rows (`repo_overview` or `file_deepdive`) are found for the repository.
- **Concurrent Blob Creation Error Handling:** The manual concurrency pool has a `firstError` mechanism. If any `createBlob` call fails, it captures the first error, stops dispatching new tasks, and rejects the main promise once all in-flight requests complete. This prevents partial state and surfaces the underlying error.
- **Idempotency:** The branch name includes a millisecond timestamp (`Date.now()`), ensuring that multiple calls for the same repository produce distinct PRs rather than colliding. The function does not handle closing or merging old PRs.

### 7. Observations

- **Code Duplication:** The source code block contains a duplicated section of code (lines for `GITHUB_TOKEN` check, `parsed`, `repoInfo`, and `defaultBranch` are repeated). This appears to be a copy-paste error in the provided source.
- **Manual Concurrency Pool:** The implementation uses a manual promise-based concurrency pool for blob creation. While effective, this pattern is error-prone and could be simplified using a library like `p-limit` for better readability and maintainability.
- **Hardcoded Concurrency:** The `BLOB_CONCURRENCY` constant is set to 8. This is a reasonable default, but it might not be optimal for all scenarios (e.g., very large repos or different rate limit states).
- **PR Body Content:** The `buildPrBody` function generates a detailed PR description, which is good for user transparency. However, it explicitly states that cross-file context is not retrieved, which is a known limitation of the current generation process.