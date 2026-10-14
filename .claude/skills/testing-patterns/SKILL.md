---
name: testing-patterns
description: Vitest + React Testing Library patterns for this React + Vite PWA — factory functions, mocking with vi, fake timers, mobile scenarios (offline, backgrounded, reduced motion), and TDD workflow. Use when writing unit or component tests, creating test factories, or following the TDD red-green-refactor cycle.
---

# Testing Patterns and Utilities

Stack: **Vitest** (runner, `vi` mocks, fake timers) + **@testing-library/react** + **@testing-library/user-event** + **@testing-library/jest-dom** matchers, running in **jsdom**. This is a web app — never import from `@testing-library/react-native` or use Jest APIs (`jest.fn`, `jest.mock`).

## Testing Philosophy

**Test-Driven Development (TDD):**
- Write failing test FIRST
- Implement minimal code to pass
- Refactor after green
- Never write production code without a failing test

**Behavior-Driven Testing:**
- Test behavior, not implementation
- Focus on public APIs and user-visible results
- Avoid testing implementation details (internal state, hook calls, class names)
- Use descriptive test names that describe behavior

**Factory Pattern:**
- Create `getMockX(overrides?: Partial<X>)` functions
- Provide sensible defaults
- Allow overriding specific properties
- Keep tests DRY and maintainable

## Setup (already in place)

- `vite.config.ts` has a `test` block: `environment: 'jsdom'`, `setupFiles: ['./src/test/setup.ts']`.
- `src/test/setup.ts` loads jest-dom matchers, runs `cleanup()` and `vi.restoreAllMocks()` after each test, and defines a global `jest.advanceTimersByTime` shim. React Testing Library only cooperates with fake timers through that global, and without it `user-event` clicks hang under `vi.useFakeTimers()`. Don't remove it.
- `src/test/render.tsx` exports `renderWithProviders`.
- Scripts: `npm test` (watch), `npm run test:run`, `npm run test:coverage` (`@vitest/coverage-v8`).
- Versions: Vitest 5, jsdom 30, @testing-library/react 16, user-event 14, jest-dom 7.

Conventions:
- Tests sit next to the code: `IntervalTimer.tsx` → `IntervalTimer.test.tsx`.
- Shared helpers and factories live in `src/test/`.
- Import test APIs explicitly (`import { describe, it, expect, vi } from 'vitest'`) — globals are off.
- Project TS rules still apply in tests: `import type` for type-only imports, `.tsx`/`.ts` extensions on local imports, no unused variables.

## Test Utilities

### Custom Render Function

`src/test/render.tsx` wraps components with the app's providers and returns a `user` already set up. Its second argument is passed to `userEvent.setup()`:

```typescript
export const renderWithProviders = (ui: ReactElement, options?: Options) => {
  const user = userEvent.setup(options)
  return { user, ...render(ui) }
}
```

Add providers (theme, settings context, etc.) inside `render(...)` as the app grows. Component files must only export components (oxlint `only-export-components`), so keep helpers like this in `src/test/`, not next to components.

**Usage:**

```typescript
import { screen } from '@testing-library/react'
import { it, expect } from 'vitest'
import { renderWithProviders } from '../test/render.tsx'

it('shows the workout title', () => {
  renderWithProviders(<WorkoutHeader title="Tabata" />)
  expect(screen.getByRole('heading', { name: 'Tabata' })).toBeInTheDocument()
})
```

## Factory Pattern

### Component Props Factory

```typescript
import type { ComponentProps } from 'react'
import { vi } from 'vitest'

const getMockTimerControlsProps = (
  overrides?: Partial<ComponentProps<typeof TimerControls>>,
): ComponentProps<typeof TimerControls> => ({
  isRunning: false,
  onStart: vi.fn(),
  onPause: vi.fn(),
  onReset: vi.fn(),
  ...overrides,
})

it('shows Pause while running', () => {
  renderWithProviders(<TimerControls {...getMockTimerControlsProps({ isRunning: true })} />)
  expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
})
```

### Data Factory

```typescript
// src/test/factories.ts
import type { Interval } from '../intervals.ts'

export const getMockInterval = (overrides?: Partial<Interval>): Interval => ({
  id: 'interval-1',
  name: 'Work',
  durationSec: 30,
  kind: 'work',
  ...overrides,
})

it('labels rest intervals', () => {
  renderWithProviders(<IntervalRow interval={getMockInterval({ kind: 'rest', name: 'Rest' })} />)
  expect(screen.getByText('Rest')).toBeInTheDocument()
})
```

Name the type in the factory's return so a new required field fails type-checking in every factory, instead of silently producing incomplete data.

## Mocking Patterns

### Mocking Modules

```typescript
import { vi } from 'vitest'

// Auto-mock a whole module
vi.mock('../storage.ts')

// Mock with a factory
vi.mock('../analytics.ts', () => ({
  logEvent: vi.fn(),
}))

// Typed access to the mock
import { loadWorkouts } from '../storage.ts'
vi.mocked(loadWorkouts).mockReturnValue([getMockWorkout()])
```

`vi.mock` is hoisted above imports. Variables a mock factory uses must come from `vi.hoisted(() => ...)`.

### Spying

```typescript
const setItem = vi.spyOn(Storage.prototype, 'setItem')
```

`vi.restoreAllMocks()` in the setup file undoes spies after each test.

### Mocking Browser APIs jsdom Lacks

jsdom has no `matchMedia`, Wake Lock, `vibrate`, or Web Audio. Stub them per test with `vi.stubGlobal` or define them on `navigator`:

```typescript
vi.stubGlobal('matchMedia', (query: string) => ({
  matches: query === '(prefers-reduced-motion: reduce)',
  media: query,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}))

Object.defineProperty(navigator, 'wakeLock', {
  configurable: true,
  value: { request: vi.fn().mockResolvedValue({ release: vi.fn(), addEventListener: vi.fn() }) },
})
```

Call `vi.unstubAllGlobals()` in `afterEach` when a file uses `stubGlobal`. Production code must feature-detect these APIs, so also test the "API missing" path.

## Timers and Time

Interval logic should derive elapsed time from timestamps, so control both the clock and the timers:

```typescript
import { afterEach, beforeEach, vi } from 'vitest'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
})

it('moves to the rest interval after 30 seconds', async () => {
  const { user } = renderWithProviders(<IntervalTimer workout={getMockWorkout()} />, {
    advanceTimers: vi.advanceTimersByTime,
  })
  await user.click(screen.getByRole('button', { name: 'Start' }))
  await act(() => vi.advanceTimersByTimeAsync(30_000))
  expect(screen.getByRole('heading', { name: 'Rest' })).toBeInTheDocument()
})
```

With fake timers on, always pass `{ advanceTimers: vi.advanceTimersByTime }` to `renderWithProviders`, and keep the setup file's `jest` shim. Each one on its own still leaves clicks hanging. Don't use `shouldAdvanceTime: true` as a workaround: it lets real time leak into the clock, which makes timing assertions at exact boundaries flaky.

Prefer testing pure timing functions directly (`getCurrentInterval(workout, startedAt, now)`) with plain numbers. Keep component tests for "the UI reflects the state".

## Mobile Scenarios

Cover the cases from `.claude/skills/mobile-design/mobile-testing.md` that apply to the feature:

```typescript
// App backgrounded / screen locked, then resumed
const setVisibility = (state: DocumentVisibilityState) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state })
  document.dispatchEvent(new Event('visibilitychange'))
}

it('shows the correct remaining time after the screen was locked', async () => {
  // start timer, then:
  act(() => setVisibility('hidden'))
  vi.setSystemTime(Date.now() + 45_000) // timers are throttled while hidden: move the clock without firing ticks
  act(() => setVisibility('visible'))
  expect(screen.getByText('0:15')).toBeInTheDocument()
})

// Offline
Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
window.dispatchEvent(new Event('offline'))
```

`Object.defineProperty` overrides last for the rest of the test file, and `restoreAllMocks` doesn't undo them. Reset them in `afterEach` by deleting the own property so the prototype's getter shows through again: `Reflect.deleteProperty(navigator, 'onLine')`. Don't use `delete navigator.onLine`, even with a cast: these DOM properties are read-only, so `npm run build` fails with TS2704. (Vitest doesn't type-check, so the test itself still passes.)

jsdom can't prove layout, touch-target size, install prompts, wake lock actually holding, audio, or performance. List those as manual checks on an Android device in the plan instead of faking them.

## Test Structure

```typescript
import { beforeEach, describe, it, vi } from 'vitest'

describe('IntervalTimer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('shows the first interval before starting', () => {})
    it('shows an empty state when the workout has no intervals', () => {})
  })

  describe('User interactions', () => {
    it('starts counting down when Start is tapped', async () => {})
  })

  describe('Edge cases', () => {
    it('keeps time accurate after the app is backgrounded', () => {})
  })
})
```

## Query Patterns

Query the way a user (or screen reader) finds things. Priority: `getByRole` → `getByLabelText` → `getByText` → `getByTestId` (last resort).

```typescript
// Element must exist
expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()

// Element should not exist
expect(screen.queryByText('Paused')).not.toBeInTheDocument()

// Element appears asynchronously
expect(await screen.findByText('Saved')).toBeInTheDocument()

// Assertion that eventually becomes true
await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
```

## User Interaction Patterns

Use `user-event` (real event sequences: pointer, focus, keyboard) over `fireEvent`:

```typescript
it('saves a new interval', async () => {
  const onSubmit = vi.fn()
  const { user } = renderWithProviders(<IntervalForm onSubmit={onSubmit} />)

  await user.type(screen.getByLabelText('Name'), 'Sprint')
  await user.clear(screen.getByLabelText('Seconds'))
  await user.type(screen.getByLabelText('Seconds'), '20')
  await user.click(screen.getByRole('button', { name: 'Save' }))

  expect(onSubmit).toHaveBeenCalledWith({ name: 'Sprint', durationSec: 20 })
})
```

`user.click` stands in for a tap. There's no separate touch API to test.

## Anti-Patterns to Avoid

### Testing Mock Behavior Instead of Real Behavior

```typescript
// Bad - testing the mock
expect(mockLoadWorkouts).toHaveBeenCalled()

// Good - testing what the user sees
expect(screen.getByText('Tabata')).toBeInTheDocument()
```

### Not Using Factories

```typescript
// Bad - duplicated, inconsistent test data
it('test 1', () => {
  const interval = { id: '1', name: 'Work', durationSec: 30, kind: 'work' }
})
it('test 2', () => {
  const interval = { id: '2', name: 'Rest', durationSec: 10 } // Missing kind!
})

// Good - reusable factory
const interval = getMockInterval({ name: 'Rest', kind: 'rest' })
```

### Real Waiting

```typescript
// Bad - slow and flaky
await new Promise((r) => setTimeout(r, 30_000))

// Good - fake timers
await act(() => vi.advanceTimersByTimeAsync(30_000))
```

### Querying by Class or Structure

`container.querySelector('.counter')` breaks on restyling and says nothing about accessibility. Use roles and labels.

## Best Practices

1. **Always use factory functions** for props and data
2. **Test behavior, not implementation**
3. **Use descriptive test names**
4. **Organize with describe blocks**
5. **Clear mocks between tests**
6. **Keep tests focused** - one behavior per test
7. **Fake the clock** for anything time-based; never sleep
8. **Test every UI state** - loading, empty, error (with retry), success

## Running Tests

```bash
# Watch mode
npm test

# Single run (CI / before reporting done)
npm run test:run

# Run specific file
npx vitest run src/IntervalTimer.test.tsx

# Run tests whose name matches
npx vitest run -t "backgrounded"

# Coverage
npm run test:coverage
```

## Integration with Other Skills

- **mobile-design**: `mobile-testing.md` lists the mobile scenarios to cover (offline, lifecycle, accessibility). Ignore its Detox, Maestro and React Native Testing Library tooling, since this app is a web PWA.
- **plan-new-adhoc**: a plan's Test Cases section is drafted from these patterns. Each listed case should map to one `it(...)`.
- **Bug fixes**: write a test that reproduces the bug before fixing it.
