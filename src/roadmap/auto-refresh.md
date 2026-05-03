---
name: Auto-Refresh on Push
type: roadmap
status: planned
description: Watch a repository for new commits and automatically re-ingest and regenerate the bible whenever the source changes.
requires: ["parallel-ingestion.md", "pipeline-hardening.md"]
effort: medium
---

A bible that goes stale is worse than no bible — it builds false confidence. Auto-refresh closes the loop: when a new commit lands on the default branch, Codebase Bible re-ingests and regenerates automatically. The bible on the dashboard is always current.

## What it looks like

A dashboard indicator shows the last-scanned timestamp next to the repo name: "synced 3 minutes ago." If the source repo has pushed commits since the last scan, a subtle banner appears — "New commits detected — refreshing." The user never has to think about it.

The home page repo list gains a "watching" badge next to repos with auto-refresh enabled, distinct from the existing status pills.

## Key details

- **Watch registration:** when a user enables auto-refresh for a repo, the app registers a GitHub webhook on that repo pointing at a new webhook interface. Requires the `GITHUB_TOKEN` to have `admin:repo_hook` scope (or the user provides a separate token for webhook management).
- **Webhook trigger:** a push event to the default branch fires the webhook → triggers re-ingest → on completion, triggers `generateBible`.
- **Fallback polling:** for repos where webhook registration isn't possible (no admin token), a cron job checks each watched repo's latest commit SHA every 30 minutes and triggers a refresh if it differs from `lastScannedAt`'s commit.
- **Cost control:** only trigger if the changed files include at least one non-boilerplate file. Pure lockfile bumps and README-only changes can be skipped or batched.
- **Manual override:** the Regenerate button stays. Auto-refresh doesn't remove the user's ability to trigger on demand.

~~~
New interface: Webhook — receives GitHub push event payloads. Validates the X-Hub-Signature-256 header against a stored secret. Extracts `ref` (must match `refs/heads/<defaultBranch>`), `commits[].modified + added + removed`, and `repository.id`. Calls `ingestRepository` + schedules `generateBible` as a chained fire-and-forget.

New table column: `watchEnabled` (boolean) on Repositories. New method: `setWatchStatus({ repositoryId, enabled })`.

Cron interface: runs every 30 minutes, queries all repos with `watchEnabled = true` and `status = 'completed'`, fetches each repo's latest commit SHA from GitHub API, compares against a stored `lastCommitSha` column, triggers re-ingest on mismatch.

The parallel ingestion and pipeline hardening items are prerequisites — auto-refresh is a no-op if re-ingest is slow and unguarded.
~~~
