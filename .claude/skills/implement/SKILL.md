---
name: implement
description: Implement the active plan using strict TDD (RED → GREEN → REFACTOR). Each Test Cases bullet must be covered by a passing test driven by a clear failing test first. Use when the user invokes /implement, or asks to implement the active plan via TDD.
---

Implement the active plan using Test-Driven Development. Tests come first, production code follows.

Rules in force: `CLAUDE.md` and the `testing-patterns` skill (Vitest + React Testing Library) — both always active. Load `testing-patterns` before writing the first test. For UI work, also apply the `mobile-design` skill's platform-neutral guidance (touch targets, thumb zone, `platform-android.md`); ignore its React Native / Flutter / iOS specifics.

Steps:

1. Find and read the active plan in `docs/plan/` (excluding `TEMPLATE.md`). If there's more than one plan with `**Status:** in-progress`, ask which one — don't guess. Extract:
   - **Test Cases** — drives what tests to write. Each bullet should specify both an input and an expected output (or observable behavior). **If a bullet doesn't say what to assert** (e.g. "errors are handled", "works offline", "edge cases handled"), **stop and report it as a blocker — do not invent an interpretation.** A vague bullet is unimplementable because there's nothing to fail against; inventing scope is how a "small fix" silently becomes a hidden refactor.
   - **Open questions** (wherever the plan lists them, usually under Scope) — any question marked as blocking, or one a Test Cases bullet depends on (e.g. "exact flow per open question 4"), is a blocker. Stop and ask the user; don't pick an answer. Non-blocking questions don't stop the work, but don't implement their features either.
   - **Scope > In** — defines the production code surface you may touch.
   - **Scope > Out** — authoritative list of what you must NOT touch. If a Test Cases bullet would require touching something in Scope > Out, that's a contradiction in the plan; flag it and stop.
   - **Changes** — the files expected to be created, modified or removed. A file not listed here that you need to touch is a scope question: small supporting edits (a shared type, a test factory in `src/test/`) are fine; anything that changes behavior elsewhere goes back to the user.
   - **Mobile UX** — the states, touch targets and lifecycle behavior the UI must have. Every state named here needs a test, either from Test Cases or as part of the cycle that builds that state.
   - **Dependencies > New packages** — only install packages the plan lists. Needing an unlisted one is a blocker.

2. For each distinct behavior the Test Cases section asks for, run one TDD cycle. Order: **Unit** bullets first (pure logic), then **Component**, then **Error & edge cases** and **Mobile scenarios** — so the UI is built on logic that's already proven.
   - **RED**: write the failing test first — real assertions, no `it.skip`/`it.todo`, no `.only` left behind. Name the `it(...)` after the bullet's user-visible behavior. Use `getMockX(overrides)` factories from `src/test/factories.ts`, `renderWithProviders` from `src/test/render.tsx`, and fake timers for anything time-based (`renderWithProviders(ui, { advanceTimers: vi.advanceTimersByTime })` — see `testing-patterns`). Run the single file (`npx vitest run <file>`) and confirm the test fails for the right reason. A failed import of a module that doesn't exist yet counts as RED on the first cycle; a test that passes immediately does NOT — that means the assertion is wrong or the behavior already exists.
   - **GREEN**: write the minimum production code to pass. Don't over-implement. Run `npm run test:run` — confirm the new test passes AND no previously-passing test broke.
   - **REFACTOR**: clean up duplication, extract helpers, rename for clarity. Re-run `npm run test:run` after each refactor.

   **What "one cycle per behavior" means:** if multiple Test Cases bullets are variations of the same code path (e.g. four inputs to `formatTime`), it's fine to add them as `it.each` rows after the first RED → GREEN — the additional rows are regression coverage, not new cycles. But if a bullet introduces a different code path — a new UI state, a new branch in the timer logic, a new event listener (`visibilitychange`, `online`/`offline`) — it gets its own RED first. The rule isn't bureaucratic ceremony; it exists to keep tests honestly driving production code.

   Never:
   - Write production code without a failing test that requires it.
   - Modify a test assertion to make it pass — only change production code.
   - Remove the `jest` shim in `src/test/setup.ts` or switch to `shouldAdvanceTime` to get a hanging fake-timer test working — fix the test instead.

3. After every Test Cases bullet that can be automated has a passing test:
   - Run `npm run test:run` once more to confirm the entire suite is green.
   - Run `npm run lint` and fix any violations.
   - Run `npm run build`. Vitest strips types without checking them, so this is the only step that type-checks the tests and the production code. Fix any errors.
   - If the plan replaced or removed template files or assets, grep for leftover imports of them.

4. Update the plan's **Test Cases** and **Checklist** sections:
   - **Test Cases**: tick each bullet that now has a passing test. Leave the **Manual check on an Android device** bullets unchecked — they can't be verified here; the user does them on a phone.
   - **Checklist** — for each item:
     - **Tick** it if this implement cycle just completed it — e.g. "Tests written and passing", "`npm run lint` and `npm run build` pass".
     - **Mark N/A** (annotate the line) if the item doesn't apply to this plan.
     - **Leave unchecked** if it belongs to a later step or to the user — "Checked on a real Android device" and "This plan file deleted" are never ticked here.

   Don't fake-tick items you didn't actually do — the user reads the Checklist to know what's left.

   Set **Status** to `staging` only if every automated bullet passes and only manual checks remain; otherwise leave it `in-progress`.

5. Report:
   - Which Test Cases bullets are covered and which test file covers each.
   - Which production files were created, edited or removed.
   - `npm run test:run`, `npm run lint` and `npm run build` final status.
   - Which Checklist items were ticked, marked N/A, or left unchecked.
   - The manual Android checks still to do, and how to run the installable build on the phone: `npm run build && npm run preview`, then connect the phone by USB and forward the port with `adb reverse tcp:4173 tcp:4173` (or Chrome's `chrome://inspect` port forwarding) and open `http://localhost:4173` in Chrome on the phone. Opening the PC's LAN IP over plain HTTP (`npm run preview -- --host`) shows the layout but the service worker won't register and the app can't be installed, because those need HTTPS or `localhost`.
   - Any Test Cases bullets flagged as too vague, and any open questions that blocked work (blockers — these go back to the plan author before implementation can proceed).

Scope boundaries:
- DO NOT implement anything outside the plan's **Scope > In**. If you discover missing scope mid-cycle, stop and either (a) report it as a blocker so the user can expand the plan, or (b) add a Subtasks entry to the plan with a short description of what was deferred. Never widen silently.
- DO NOT answer the plan's open questions yourself — a sensible-looking default is still a product decision.
- DO NOT update `CLAUDE.md` or delete the plan — the user does that when the work is accepted.
