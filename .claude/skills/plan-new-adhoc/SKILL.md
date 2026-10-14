---
name: plan-new-adhoc
description: Create a new flat plan file for ad-hoc work (no ticket). Use when the user invokes /plan-new-adhoc with a slug, or asks to start a blank plan without a ticket.
---

Create a new flat plan file for ad-hoc work (no ticket). `$ARGUMENTS` is a kebab-case slug (e.g. `refactor-interval-page`). If the slug arrives with spaces or capitals, normalize to lowercase-kebab before using it.

Steps:
1. Copy `docs/plan/TEMPLATE.md` to `docs/plan/{slug}.md` — use the slug as-is, no ticket-id prefix, no duplicate suffix (e.g. `/plan-new-adhoc refactor-interval-page` → `docs/plan/refactor-interval-page.md`).
2. Rewrite the title line `# Ticket: {TICKET_ID} — {Feature Name}` to `# {Feature Name}` — keep the `{Feature Name}` placeholder so the user fills in a human-readable title. Ad-hoc plans have no ticket ID; inventing one (`AD-HOC-001` etc.) breaks the convention.
3. Set `**Started:** YYYY-MM-DD` to today's date.
4. Leave Goal, Scope, Changes, Mobile UX, Test Cases, and everything else blank — there's no ticket to draft from.
5. Do NOT read `docs/docs.md`, the skill reference files, or explore the codebase at this stage. The plan is blank, so there's nothing to inform yet.

Why these constraints: this skill exists to make starting an ad-hoc plan a one-step action. Any auto-drafting risks the model inventing scope the user didn't ask for. The blank file is the deliverable — the user provides the intent next.

Expected workflow after this skill runs:
1. Skill creates the blank plan and stops.
2. User describes the work in chat (what, why, constraints).
3. You then fill in title, Goal, Scope, Changes, and the sections below from that description. Read `CLAUDE.md` and only the code the work touches.

If the user includes the work description in the same message as the slug (e.g. `/plan-new-adhoc pause-resume — keep the timer accurate when the screen locks`), do steps 1 and 3 together: create the file, then immediately draft from their description.

## Drafting the Mobile UX section

The app is an installable PWA for Android only (React + Vite, not React Native). Draft this section with the `mobile-design` skill's platform-neutral guidance: `touch-psychology.md` (thumb zone, 48dp targets), `platform-android.md` (Material 3, system back), and the per-screen checklist in its `SKILL.md`. Ignore its React Native and Flutter specifics (FlatList, `useNativeDriver`, SecureStore, Detox) and anything iOS-only.

- Fill only rows that apply to the described work; delete the rest rather than writing "N/A".
- Every screen the work touches needs its loading / empty / error / success states named — these become test cases.
- If a row needs a product decision the user hasn't made (e.g. "should the timer keep running when the app is killed?"), write it as an open question in the row instead of choosing.

## Drafting the Test Cases section

Follow the `testing-patterns` skill's principles: behaviour over implementation, one behaviour per case, names that read as user-visible behaviour ("shows the next interval's name when the current one ends"), and `getMockX(overrides)` factories for props and data. Adapt its examples to this web stack: `@testing-library/react` with `userEvent`/`fireEvent.click`, not `@testing-library/react-native` or `fireEvent.press`.

- **Unit:** pure logic (interval math, formatting, persistence). Put timing logic here, using fake timers and injected clocks, not in component tests.
- **Component:** one case per UI state from Mobile UX, plus the main interactions.
- **Mobile scenarios:** pick from the `mobile-design` skill's `mobile-testing.md` the ones that apply: offline, backgrounded/resumed, slow network, rotation, reduced motion, screen reader.
- **Manual on Android device:** anything jsdom can't prove — install prompt, wake lock, audio/vibration, gesture bar overlap, performance on a low-end phone.

Tests run on Vitest (`npm run test:run`). Name new test files `*.test.tsx` next to the code they cover, and put shared factories in `src/test/`.

Note: subtasks and PR splits are not planned upfront — they emerge during work and are added to the plan's Subtasks section as they're discovered.

Output: the plan file path, plus a prompt for the user to fill in the title (`# {Feature Name}`), Goal, Scope, and — if they want tests planned — the Mobile UX and Test Cases sections (or to describe the work so you can draft them).
