---
name: close-ticket
description: Close the active plan once its work is accepted: verify the build, check scope, propose docs/docs.md updates, merge them on confirmation, save memory, delete the plan. Use when the user invokes /close-ticket, says to close the plan, says the work is done or accepted, or wants to wrap up or clean up the plan file.
---

Close the active plan once the work is accepted. Verify, check scope, propose doc updates, get confirmation, merge, then delete the plan. This skill never commits. When the project is a git repo, the user reviews the diff and commits when ready.

Steps:
1. Find the active plan in `docs/plan/` (excluding `TEMPLATE.md`). If there's more than one, ask which one to close; don't guess. Read it fully, then read `docs/docs.md` and the `## Status` section of `CLAUDE.md`.
2. Check the plan's **Status**. If it isn't `staging`, ask: "Not everything automated is ticked; close anyway?" On `no`, stop here, because closing is premature.
3. **Verify** with `npm run test:run`, `npm run lint` and `npm run build`. If any fails, report it and stop: a plan isn't closed on a red build.
4. **Scope check.**
   - In a git repo: compare `git status` / `git diff --stat` against the plan's **Scope > In** and **Changes**, and flag files the plan doesn't account for.
   - Otherwise there's no history to diff. List the files the plan's **Changes** names, check each still exists (or is gone, if listed as removed), and say plainly that unlisted edits can't be detected without git.
   - If anything is flagged, ask the user to confirm it's intentional. On `no`, stop here.
5. **Decide what moves into `docs/docs.md`.** The plan is about to be deleted, so anything that should outlive it must land in docs first. Candidates:
   - **Decided** items → `## Behaviour`, merged into the existing bullets and tables (e.g. the sounds table, the counter table), not appended as a changelog. Superseded decisions (struck through in the plan) are left out. Only their replacement is documented.
   - **Key Design Decisions** that explain a non-obvious rule ("we chose X because Y; future work must respect Z") → `## Design notes`. Skip ones the code makes obvious.
   - **Risks** still open after the work, and limitations the user accepted → `## Known limitations`. Also remove any existing limitation this plan resolved.
   - **Scope > Out** items marked as follow-ups → `## Follow-ups (not started)`. Remove follow-ups this plan completed.
   - **Unticked "Manual check on an Android device" bullets** → appended to `## Not yet checked on an Android device`. First ask whether the user has done any of them. Drop the ones they confirm, and say which remain.
   - The plan name in the `## Behaviour` intro line ("Decided … (plans `x`, `y` …)").

   Also check `CLAUDE.md`'s `## Status` paragraph: if it now misdescribes the app (e.g. what `App.tsx` renders), propose a one-line fix. Don't touch the rest of `CLAUDE.md`.

   If nothing qualifies, say so and skip to step 8.
6. **Propose, don't write.** Tell the user which `docs/docs.md` sections change and the *intent* of each change: what fact is added, updated or removed, and where. Don't paste final prose. Ask: "Merge into docs/docs.md? (yes / no / edit)"
7. On `yes`, write the changes. On `edit`, write them with the user's edits as constraints. On `no`, skip.
   - When writing, follow `docs/docs.md`'s existing style and structure. Update in place rather than append, and dedupe against what's there.
   - Afterwards, re-read the changed sections and confirm nothing still contradicts the new behaviour (e.g. an old table row or a resolved limitation).
   - If writing fails or is interrupted, STOP and keep the plan.
8. Ask whether anything was *surprising or non-obvious* worth saving to memory. Save only if they say yes (type `project` or `feedback`). Check `MEMORY.md` for an existing entry on the same topic and update it rather than duplicating. Skip routine plans.
9. **Delete the plan file**, only after step 7 succeeded or was explicitly skipped.
   - Check that nothing outside `docs/docs.md`'s history line still references it by path.
   - If the project isn't a git repo, say before deleting that the plan can't be recovered afterwards. Step 5's merge is what preserves it.
10. Confirm:
    - what was merged into `docs/docs.md` (and `CLAUDE.md`, if anything)
    - what memory was saved, if any
    - which manual Android checks remain open
    - that the plan was deleted.

The user is the decider. You draft and ask; never silently bloat `docs/docs.md`.
