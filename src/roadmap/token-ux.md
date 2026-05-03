---
name: Token Setup Guide
type: roadmap
status: planned
description: Walk users through creating a GitHub token with the right scopes, validate it upfront, and surface clear errors when permissions fall short.
requires: []
effort: quick
---

The PR feature has already surfaced a real UX gap: fine-grained PATs fail in ways that aren't obvious, and the error message from the GitHub API doesn't tell a non-expert what to do next. The token setup guide closes this gap with a short inline wizard and a validation step before the user ever clicks Push.

## What it looks like

A "Configure GitHub Token" link lives in the toolbar (or in the Push modal, if one is added). Clicking it opens a small inline panel — not a full-page route — with three things:

1. **Step-by-step instructions** for creating a classic PAT with the `repo` scope, with a direct link to `github.com/settings/tokens/new`. A secondary note covers fine-grained PATs and the exact permissions required (Contents: Read and write, Pull requests: Read and write).
2. **A token input field** with a "Validate" button. Validation makes a real GitHub API call (`GET /user`) to check the token is valid, then a `GET /rate_limit` check to confirm it's authenticated.
3. **Scope feedback.** If the entered token lacks the required scopes, the panel shows exactly what's missing and links directly to the GitHub docs for that permission.

After a successful validation the token is stored (this is the `GITHUB_TOKEN` secret flow or a user-level stored value depending on whether auth has shipped). The Push button in the toolbar shows a mint checkmark badge when a valid token is configured.

## Key details

- Token validation is a new `validateGithubToken` method — lightweight, just a few GitHub API calls, returns `{ valid, login, scopes, missingScopes }`.
- The classic PAT / fine-grained PAT distinction is surfaced explicitly. Classic PATs are recommended until the fine-grained flow is proven stable.
- On PR failure, the error toast includes an actionable message: "Token may be missing pull_requests:write. Check your token settings →" with a link to the setup guide.
- If no token is configured at all, the Push button shows a tooltip: "GitHub token required — click to configure."

~~~
New method: `validateGithubToken({ token })`. Calls GitHub `GET /user` with the token as Bearer auth. For classic PATs, reads the `X-OAuth-Scopes` response header. For fine-grained PATs, that header is absent — instead make a trial call to `GET /repos/:owner/:repo` with a known public repo and check the response status. Returns `{ valid: boolean, login: string | null, tokenType: 'classic' | 'fine-grained' | 'unknown', scopes: string[], missingScopes: string[] }`.

Frontend: the panel is a collapsible section, not a modal, so it doesn't interrupt the dashboard layout. Use the same 1px-bordered card pattern as the rest of the UI.
~~~
