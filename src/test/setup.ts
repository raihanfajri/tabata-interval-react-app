import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// React Testing Library only cooperates with fake timers through a global
// `jest.advanceTimersByTime`; without it, user-event clicks hang under
// vi.useFakeTimers(). It's only consulted while fake timers are active.
Object.assign(globalThis, {
  jest: { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) },
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  // The timer saves itself to localStorage; don't leak a running workout into the next test.
  localStorage.clear()
})
