import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'

type Options = Parameters<typeof userEvent.setup>[0]

// Renders `ui` with the app's providers and returns a ready `user`.
// With fake timers, pass { advanceTimers: vi.advanceTimersByTime }.
export const renderWithProviders = (ui: ReactElement, options?: Options) => {
  const user = userEvent.setup(options)
  return { user, ...render(ui) }
}
