import { act, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { renderWithProviders } from './test/render.tsx'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))

describe('New Workout form', () => {
  it('opens on the "New Workout" form with the default values and "Total 8:18" when nothing is saved or in progress', () => {
    renderWithProviders(<App />)

    expect(screen.getByRole('heading', { name: 'New Workout' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Prepare (seconds)' })).toHaveValue('8')
    expect(screen.getByRole('textbox', { name: 'Work (seconds)' })).toHaveValue('20')
    expect(screen.getByRole('textbox', { name: 'Rest (seconds)' })).toHaveValue('10')
    expect(screen.getByRole('textbox', { name: 'Rest between sets (seconds)' })).toHaveValue('30')
    expect(screen.getByRole('textbox', { name: 'Sets' })).toHaveValue('2')
    expect(screen.getByRole('textbox', { name: 'Cycles per set' })).toHaveValue('8')
    expect(screen.getByText('Total 8:18')).toBeInTheDocument()
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
  })

  it('changing Work to 30s updates the total, and Start opens the timer whose Work screen shows 0:30 after Prepare', async () => {
    const { user } = renderWithProviders(<App />, { advanceTimers: vi.advanceTimersByTime })
    const work = screen.getByRole('textbox', { name: 'Work (seconds)' })

    await user.clear(work)
    await user.type(work, '30')
    expect(screen.getByText('Total 10:58')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Start' }))
    await advance(8_000)
    expect(screen.getByRole('heading', { name: 'Work' })).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('0:30')
  })

  it('the next launch shows the settings last used', async () => {
    const first = renderWithProviders(<App />, { advanceTimers: vi.advanceTimersByTime })
    const sets = screen.getByRole('textbox', { name: 'Sets' })
    await first.user.clear(sets)
    await first.user.type(sets, '3')
    await first.user.click(screen.getByRole('button', { name: 'Start' }))
    first.unmount()
    // No workout in progress (it would reopen on the timer); only the settings matter here.
    Object.keys(localStorage)
      .filter((k) => k.startsWith('interval-app:timer:'))
      .forEach((k) => localStorage.removeItem(k))

    renderWithProviders(<App />)

    expect(screen.getByRole('textbox', { name: 'Sets' })).toHaveValue('3')
  })
})

// Android back reaches the page as a popstate event.
const pressBack = () =>
  act(() => {
    window.dispatchEvent(new PopStateEvent('popstate'))
  })

const openApp = () => renderWithProviders(<App />, { advanceTimers: vi.advanceTimersByTime })

const startFromForm = async (app: ReturnType<typeof openApp>) => {
  await app.user.click(screen.getByRole('button', { name: 'Start' }))
}

describe('Android back and reopening', () => {
  const exitSheet = () =>
    screen.getByRole('alertdialog', { name: 'Reset workout and go back to settings?' })

  it('back on the idle timer goes straight to the form', async () => {
    const app = openApp()
    await startFromForm(app)
    await app.user.click(screen.getByRole('button', { name: 'Reset' }))
    await app.user.click(
      within(screen.getByRole('alertdialog', { name: 'Reset workout?' })).getByRole('button', { name: 'Reset' }),
    )
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument() // idle timer

    await pressBack()

    expect(screen.getByRole('heading', { name: 'New Workout' })).toBeInTheDocument()
  })

  it('back on the Done timer goes straight to the form', async () => {
    const app = openApp()
    await startFromForm(app)
    await advance(508_000)
    expect(screen.getByRole('heading', { name: 'Done' })).toBeInTheDocument()

    await pressBack()

    expect(screen.getByRole('heading', { name: 'New Workout' })).toBeInTheDocument()
  })

  it('back while running pauses the countdown and shows "Reset workout and go back to settings?"', async () => {
    const app = openApp()
    await startFromForm(app)
    await advance(3_000) // Prepare 5

    await pressBack()
    await advance(10_000)

    expect(exitSheet()).toBeInTheDocument()
    expect(screen.getByRole('timer', { hidden: true })).toHaveTextContent(/^5$/)
  })

  it('in that sheet, Cancel continues the workout from where it was, without counting the sheet time', async () => {
    const app = openApp()
    await startFromForm(app)
    await advance(3_000) // Prepare 5
    await pressBack()
    await advance(10_000)

    await app.user.click(within(exitSheet()).getByRole('button', { name: 'Cancel' }))
    await advance(1_000)

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent(/^4$/)
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  })

  it('back again while that sheet is open dismisses it like Cancel, and the workout continues', async () => {
    const app = openApp()
    await startFromForm(app)
    await advance(3_000) // Prepare 5
    await pressBack()
    expect(exitSheet()).toBeInTheDocument()

    await pressBack()
    await advance(1_000)

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent(/^4$/)
  })

  it('in that sheet, Cancel while it was already paused keeps it paused', async () => {
    const app = openApp()
    await startFromForm(app)
    await advance(3_000)
    await app.user.click(screen.getByRole('button', { name: 'Pause' }))
    await pressBack()

    await app.user.click(within(exitSheet()).getByRole('button', { name: 'Cancel' }))
    await advance(5_000)

    expect(screen.getByText('Paused')).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent(/^5$/)
  })

  it('in that sheet, Reset clears the workout and shows the form with the same settings', async () => {
    const app = openApp()
    const work = screen.getByRole('textbox', { name: 'Work (seconds)' })
    await app.user.clear(work)
    await app.user.type(work, '45')
    await startFromForm(app)
    await advance(3_000)
    await pressBack()

    await app.user.click(within(exitSheet()).getByRole('button', { name: 'Reset' }))

    expect(screen.getByRole('heading', { name: 'New Workout' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Work (seconds)' })).toHaveValue('45')
  })

  it('reopening the app mid-workout continues the last session on the timer with its custom times', async () => {
    const app = openApp()
    const work = screen.getByRole('textbox', { name: 'Work (seconds)' })
    await app.user.clear(work)
    await app.user.type(work, '45')
    await startFromForm(app)
    await advance(10_000) // Work 0:43

    app.unmount()
    vi.setSystemTime(Date.now() + 5_000)
    openApp()

    expect(screen.queryByRole('heading', { name: 'New Workout' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Work' })).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('0:38')
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  })

  it('reopening after a workout was reset (from the back sheet) opens on the form', async () => {
    const app = openApp()
    await startFromForm(app)
    await advance(3_000)
    await pressBack()
    await app.user.click(within(exitSheet()).getByRole('button', { name: 'Reset' }))

    app.unmount()
    openApp()

    expect(screen.getByRole('heading', { name: 'New Workout' })).toBeInTheDocument()
  })

  it('reopening after a workout finished opens on the form', async () => {
    const app = openApp()
    await startFromForm(app)
    await advance(508_000)
    expect(screen.getByRole('heading', { name: 'Done' })).toBeInTheDocument()

    app.unmount()
    openApp()

    expect(screen.getByRole('heading', { name: 'New Workout' })).toBeInTheDocument()
  })
})

// Default workout: Prepare 8s; set 1 = 7 × (Work 20s, Rest 10s) + Work; 30s break; set 2 = 8 × (Work, Rest).
describe('App', () => {
  it('after Start on the form, shows the Prepare screen: "Prepare", 8, "Next: Work · 0:20" and chips "Set 1/2" and "Round 1/8"', async () => {
    const { user } = renderWithProviders(<App />, { advanceTimers: vi.advanceTimersByTime })
    await user.click(screen.getByRole('button', { name: 'Start' }))

    expect(screen.getByRole('heading', { name: 'Prepare' })).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent(/^8$/)
    expect(screen.getByText('Next: Work · 0:20')).toBeInTheDocument()
    expect(screen.getByText('Set 1/2')).toBeInTheDocument()
    expect(screen.getByText('Round 1/8')).toBeInTheDocument()
  })

  it('labels the chips for TalkBack as "Set 1 of 2" and "Round 1 of 8"', async () => {
    const { user } = renderWithProviders(<App />, { advanceTimers: vi.advanceTimersByTime })
    await user.click(screen.getByRole('button', { name: 'Start' }))

    expect(screen.getByText('Set 1 of 2')).toHaveClass('visually-hidden')
    expect(screen.getByText('Round 1 of 8')).toHaveClass('visually-hidden')
    expect(screen.getByText('Set 1/2')).toHaveAttribute('aria-hidden', 'true')
  })

  it('alternates to 10s of Rest after the first Work interval', async () => {
    const { user } = renderWithProviders(<App />, { advanceTimers: vi.advanceTimersByTime })

    await user.click(screen.getByRole('button', { name: 'Start' }))
    await advance(28_000)

    expect(screen.getByRole('heading', { name: 'Rest' })).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('0:10')
    expect(screen.getByText('Round 1/8')).toBeInTheDocument()
  })

  it("the first Work screen shows 'Round 1/8' and set 1's last Work screen shows 'Round 8/8'", async () => {
    const { user } = renderWithProviders(<App />, { advanceTimers: vi.advanceTimersByTime })

    await user.click(screen.getByRole('button', { name: 'Start' }))
    await advance(8_000) // first Work
    expect(screen.getByRole('heading', { name: 'Work' })).toBeInTheDocument()
    expect(screen.getByText('Round 1/8')).toBeInTheDocument()

    await advance(7 * 30_000) // set 1's last Work
    expect(screen.getByRole('heading', { name: 'Work' })).toBeInTheDocument()
    expect(screen.getByText('Round 8/8')).toBeInTheDocument()
  })

  describe('Rest between sets', () => {
    const startAndAdvance = async (ms: number) => {
      const app = renderWithProviders(<App />, { advanceTimers: vi.advanceTimersByTime })
      await app.user.click(screen.getByRole('button', { name: 'Start' }))
      await advance(ms)
      return app
    }

    it("after set 1's last Work, shows the break screen: 'Set 1 complete', 'Rest between sets', 0:30, the Next line and chips Set 1/2, Round 8/8", async () => {
      await startAndAdvance(238_000)

      expect(screen.getByText('Set 1 complete')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Rest between sets' })).toBeInTheDocument()
      expect(screen.getByRole('timer')).toHaveTextContent('0:30')
      expect(screen.getByText('Next: Set 2 · Work 0:20')).toBeInTheDocument()
      expect(screen.getByText('Set 1/2')).toBeInTheDocument()
      expect(screen.getByText('Round 8/8')).toBeInTheDocument()
    })

    it("the normal Rest screen shows no 'Set … complete' line and no Next line", async () => {
      await startAndAdvance(28_000) // set 1's first Rest

      expect(screen.getByRole('heading', { name: 'Rest' })).toBeInTheDocument()
      expect(screen.queryByText(/complete$/)).not.toBeInTheDocument()
      expect(screen.queryByText(/^Next:/)).not.toBeInTheDocument()
    })

    it("when the break ends, set 2's first Work shows chips Set 2/2 and Round 1/8", async () => {
      await startAndAdvance(268_000)

      expect(screen.getByRole('heading', { name: 'Work' })).toBeInTheDocument()
      expect(screen.getByText('Set 2/2')).toBeInTheDocument()
      expect(screen.getByText('Round 1/8')).toBeInTheDocument()
    })

    it('pausing during the break shows Paused and Resume on the break screen', async () => {
      const { user } = await startAndAdvance(245_000)

      await user.click(screen.getByRole('button', { name: 'Pause' }))

      expect(screen.getByRole('heading', { name: 'Rest between sets' })).toBeInTheDocument()
      expect(screen.getByText('Set 1 complete')).toBeInTheDocument()
      expect(screen.getByText('Paused')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument()
    })

    it("Done follows set 2's last Work, with no Rest and no second break in between", async () => {
      await startAndAdvance(497_000) // set 2's last Work, 0:01 left

      expect(screen.getByRole('heading', { name: 'Work' })).toBeInTheDocument()
      expect(screen.getByText('Round 8/8')).toBeInTheDocument()
      expect(screen.getByText('Set 2/2')).toBeInTheDocument()

      await advance(1_000)
      expect(screen.getByRole('heading', { name: 'Done' })).toBeInTheDocument()
    })

    it("announces 'Rest between sets, 30 seconds' in the live region when the break begins", async () => {
      await startAndAdvance(238_000)

      expect(screen.getByRole('status')).toHaveTextContent('Rest between sets, 30 seconds')
    })
  })
})
