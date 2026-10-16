---
name: commit-push
description: Commit the working tree's changes and push them to GitHub (origin). It checks first with `make check`, groups the changes into one commit per logical change, writes the messages, asks whether to push to main or to a new branch, then pushes. Use when the user invokes /commit-push, or says to commit and push, push the changes, ship or upload the work to GitHub or the remote, or sync the repo, even if they only say "commit this" or "push it".
---

Commit what's in the working tree and push it to `origin`. Pushing publishes the work, so nothing gets committed or pushed until the user has seen the plan and said yes. The user answers one question, after the checks pass, and that answer covers the whole run.

## 1. Look at what's there

Run these together:
- `git status --short`
- `git diff` and `git diff --staged`
- `git log --oneline -5`, to match the existing message style
- `git branch --show-current` and `git rev-parse --abbrev-ref @{u}`, to find the current branch and its upstream

If there's nothing to commit and nothing unpushed, say so and stop.

Read every changed and untracked file's diff before planning. Commits shouldn't contain anything you haven't looked at. Flag files that look unintended instead of quietly including them:
- secrets (`.env`, keystores, tokens)
- build output (`dist/`, `dist-android/`, `android/app/build/`)
- large binaries
- stray scratch files

A plan file in `docs/plan/` is a judgement call. Mention it, because plans are deleted at `/close-ticket`, and let the user decide.

## 2. Run the checks

Run `make check` (lint, then tests, then build). If `make` isn't available, run `npm run lint && npm run test:run && npm run build` instead.

If anything fails, stop and show the failure. Don't commit, and don't change code to get to green unless the user asks. A red commit on `main` breaks the next person's checkout, and a fix made here would land in the commit unreviewed. The only exception is when the user explicitly says to commit anyway. Then note in the commit body which check failed.

## 3. Plan the commits

Group the changes into one commit per logical change. For example, a feature and its tests go together, and an unrelated tooling file like a new `Makefile` gets its own commit. Each commit should make sense on its own and leave the tests passing.

If one file mixes changes that belong to different commits, keep the whole file in one commit and say so. Splitting hunks needs `git add -p`, which is interactive and doesn't work here.

Match the messages to this repo's history:
- **Subject:** sentence case, no `feat:`-style prefix, at most ~72 characters. Say what changed for the user or the codebase, e.g. "End the workout on the last Work, without a final Rest".
- **Body:** wrapped at 72 characters. Say why, plus anything a reviewer wouldn't see in the diff (e.g. "the workout name gets a v2 marker so timers saved under the old shape are ignored"). Skip the body for a commit that is obvious from its subject.
- **Trailer:** end with the attribution trailer the session's instructions give (currently a `Co-Authored-By:` line). If none is given, add none.

## 4. Confirm

Show the plan and ask with `AskUserQuestion`. Ask where to push every time, since the user wants to decide that per run.
- **The commits:** for each one, the subject, the body, and the files in it.
- **Any flagged files:** state whether they're included or left out.
- **Where to push:**
  - **`main`:** commit here and push `origin/main`.
  - **A new branch:** suggest a kebab-case name based on the change, e.g. `remove-last-rest`. The user can rename it.

If the user only asked to commit, ask whether to push at all, and don't push without a yes.

## 5. Commit

- If pushing to a new branch, create it first: `git switch -c <name>`. Uncommitted changes come along.
- Stage each commit's files by path, e.g. `git add src/timer/settings.ts src/timer/settings.test.ts`. Never use `git add -A` or `git add .`. Staging by path keeps flagged and unrelated files out.
- Pass the message through a heredoc (`git commit -F - <<'EOF' … EOF`) so line breaks and the trailer survive.
- Never use `--no-verify`. If a hook fails, fix the cause or report it. Then make a new commit; don't amend, since the failed commit never happened.
- After each commit, run `git status --short` to confirm only the intended files went in.

## 6. Push

1. Run `git fetch origin`, then compare with the target.
   - If the remote has commits you don't have, stop and ask whether to rebase onto them or merge them. Both rewrite or add history the user should choose.
   - Never force-push unless the user explicitly asks in this conversation.
2. Push:
   - **`main`:** `git push origin main`.
   - **New branch:** `git push -u origin <name>`.
3. For a new branch, show the "Create a pull request" URL from the push output. If `gh` is installed and the user wants a PR, open one with `gh pr create`. End the PR description with the attribution line the session's instructions give.
4. If the push is rejected (auth, protected branch, network), show the error. Leave the commits in place, since they're safe locally, and suggest the fix, e.g. `! git push` to sign in interactively.

## 7. Report

- Each commit: short hash and subject.
- Where it went (`origin/main` or `origin/<branch>`), plus the PR or compare URL if there is one.
- The check results.
- Anything left uncommitted, and why (flagged files, or ones the user excluded).
