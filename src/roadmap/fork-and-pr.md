---
name: PR for Any Public Repo
type: roadmap
status: planned
description: Open a documentation PR on any public repository by forking it first, so no write access to the source repo is required.
requires: ["token-ux.md"]
effort: medium
---

The current PR flow requires the token holder to have write access to the target repository. That means you can only push bibles to repos you own or are a collaborator on. Fork-and-PR removes that constraint: the app forks the repo under the token holder's account, opens the PR from the fork, and any public repo becomes a valid target.

This is a significant expansion of the product's reach — a user can generate a bible for any open source project and immediately open a PR to share it back with the maintainers.

## What it looks like

The Push to GitHub flow detects whether the token holder has write access to the repo. If they do, it uses the existing direct-PR path. If they don't, it automatically switches to the fork-and-PR path — no UI change for the user. The success toast reads: "PR opened from your fork: `your-handle/repo-name`" so the user knows what happened.

An optional "always fork" toggle in the token settings panel lets users who prefer not to use their write access enforce the fork path even on repos they own.

## Key details

- **Write-access detection:** before opening the PR, check `GET /repos/:owner/:repo` for the `permissions.push` field. If false, fall back to fork-and-PR.
- **Fork creation:** `POST /repos/:owner/:repo/forks`. The fork is created under the authenticated user's account. GitHub forks are async — the method polls `GET /repos/:authenticated-user/:repo` until it exists (up to 30 seconds, 2-second intervals).
- **Sync the fork:** after creation, the fork may be behind the upstream default branch. Force-push the upstream HEAD to the fork's default branch before creating the doc branch.
- **Open the PR:** same Git Data API chain as today, but the branch is pushed to the fork and the PR is opened cross-repo (head: `user:codebase-bible-{ms}`, base: `upstream:default`).
- **No cleanup:** the fork remains after the PR is opened. The user can delete it from GitHub if desired — the app does not manage fork lifecycle.

~~~
Modify `openDocumentationPR` to accept an optional `strategy: 'direct' | 'fork' | 'auto'` parameter (default `'auto'`). The auto strategy runs the write-access check and branches accordingly. Fork creation, polling, and the cross-repo PR open are new code paths in the same method.

Token scope requirement for fork-and-PR: the classic PAT `repo` scope is sufficient (it includes fork creation). Fine-grained PATs need Contents + Pull requests on the fork (which the token holder owns), plus Contents read on the source repo (already implied by public access).

Edge case: if the fork already exists (user has previously documented this repo), skip the fork creation step and go straight to the sync + branch step.
~~~
