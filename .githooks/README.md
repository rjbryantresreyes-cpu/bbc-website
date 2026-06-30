# BBC git guards

Shared git hooks that protect the live site. **Install once per device/clone:**

```bash
cd C:/BBC/bbc-website
git config core.hooksPath .githooks
```

## What `pre-push` does
1. **Blocks a push when your copy is behind** the live site (origin/master). You must
   `git pull --rebase origin master` first. This stops an old copy from overwriting newer work.
2. **Protects the core live files** — the messenger (`chat/`, `netlify/functions/bbc-msg.mjs`) and
   the dashboard (`os/index.html`, `os-preview/index.html`). A normal page push (e.g. a new tool or
   article) goes through fine. A push that changes those core files is blocked unless you confirm:
   ```bash
   BBC_ALLOW_CORE=1 git push
   ```
   RJ/Claude set that flag when editing the messenger on purpose. A VA who trips this almost
   certainly committed from an old copy — fix with `git checkout origin/master -- <file>`.

## Why this exists
On 2026-07-01 a push from a stale working copy reverted the entire messenger + team photos +
insights page on the live site. This guard makes that mistake impossible to push by accident.

## Good habit for everyone
Before committing: `git pull --rebase origin master`, then `git add <specific files>` (never a blind
`git add .` / `git add -A` from an old tree).
