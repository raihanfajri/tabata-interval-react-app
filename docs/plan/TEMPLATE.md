# Ticket: {TICKET_ID} — {Feature Name}

**Started:** {YYYY-MM-DD}
**Status:** in-progress
<!-- Status options: in-progress | staging | done -->

## Goal

<!-- 1-2 sentences: what this achieves for the user and why -->

## Scope

**In:**
- 

**Out:**
- 

## Changes

<!-- Screens, components, hooks, and pure logic modules added or modified -->
- New: 
- Modified: 

## Mobile UX (Android PWA)

<!-- See .claude/skills/mobile-design (touch-psychology.md, platform-android.md). Delete rows that don't apply. -->
- Primary action & thumb zone: <!-- main action in the bottom third; destructive actions out of easy reach -->
- Touch targets: <!-- ≥48dp, ≥8dp apart; any gesture has a button alternative -->
- States: <!-- loading / empty / error (with retry) / success: what each looks like -->
- Offline: <!-- works offline? what is persisted (localStorage, IndexedDB)? -->
- Lifecycle: <!-- behaviour when backgrounded, screen locked, or app killed and reopened; timers derive from timestamps -->
- Back button: <!-- what system back does on this screen; never hijacked -->
- Accessibility: <!-- labels, aria-live for changing values, contrast in light and dark -->

## Subtasks

<!-- Optional. Add when subtasks emerge mid-work. -->
<!-- - [ ] {sub-id or slug} — {one-line description} — depends on: {other subtask if any} -->

## Key Design Decisions

<!-- Decisions made during this work that future engineers should know -->
- 

## Risks & Rollback

- Risks:
- Rollback: <!-- revert PR, service-worker update considerations, etc. -->

## Dependencies

- New packages:
- Blocked on:

## Test Cases

<!-- See .claude/skills/testing-patterns. Test behaviour, not implementation; describe each case as user-visible behaviour. -->
<!-- Use getMockX(overrides) factories for props and data; cover every UI state listed under Mobile UX. -->

**Unit (pure logic):**
- [ ] 

**Component (render + user interaction):**
- [ ] 

**Error & edge cases:**
- [ ] 

**Mobile scenarios:**
<!-- offline, app backgrounded/resumed, slow network, rotation, reduced motion, screen reader -->
- [ ] 

**Manual check on an Android device** (installed PWA via `npm run build && npm run preview`):
- [ ] 

## Checklist

- [ ] Tests written and passing
- [ ] `npm run lint` and `npm run build` pass
- [ ] Checked on a real Android device
- [ ] This plan file deleted
