import { act, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getMockInterval, getMockWorkout } from '../test/factories.ts'
import { renderWithProviders } from '../test/render.tsx'
import IntervalTimerScreen from './IntervalTimerScreen.tsx'
import { withPrepare } from './intervals.ts'

// getMockWorkout(): Work 20s, then Rest 10s.
const renderScreen = (workout = getMockWorkout()) =>
  renderWithProviders(<IntervalTimerScreen workout={workout} />, {
    advanceTimers: vi.advanceTimersByTime,
  })

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))

// Android throttles timers while the app is hidden, so move the clock
// without firing any ticks, then make the page visible again.
const setVisibility = (state: DocumentVisibilityState) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state })
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}
const hideFor = (ms: number) => {
  setVisibility('hidden')
  vi.setSystemTime(Date.now() + ms)
  setVisibility('visible')
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
  Reflect.deleteProperty(document, 'visibilityState')
})

describe('IntervalTimerScreen', () => {
  describe('Rendering', () => {
    it("shows the first interval's name and duration before starting", () => {
      renderScreen()

      expect(screen.getByRole('heading', { name: 'Work' })).toBeInTheDocument()
      expect(screen.getByRole('timer')).toHaveTextContent('0:20')
      expect(screen.getByText('Round 1/1')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Start' })).toBeEnabled()
    })
  })

  describe('User interactions', () => {
    it('counts down after Start is tapped', async () => {
      const { user } = renderScreen()

      await user.click(screen.getByRole('button', { name: 'Start' }))
      await advance(1_000)
      expect(screen.getByRole('timer')).toHaveTextContent('0:19')

      await advance(5_000)
      expect(screen.getByRole('timer')).toHaveTextContent('0:14')
      expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    })

    it('freezes the time and shows Paused when Pause is tapped', async () => {
      const { user } = renderScreen()
      await user.click(screen.getByRole('button', { name: 'Start' }))
      await advance(3_000)

      await user.click(screen.getByRole('button', { name: 'Pause' }))
      await advance(5_000)

      expect(screen.getByRole('timer')).toHaveTextContent('0:17')
      expect(screen.getByText('Paused')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument()
    })

    it('continues from the frozen time when Resume is tapped (paused time is not counted)', async () => {
      const { user } = renderScreen()
      await user.click(screen.getByRole('button', { name: 'Start' }))
      await advance(3_000)
      await user.click(screen.getByRole('button', { name: 'Pause' }))
      await advance(60_000)

      await user.click(screen.getByRole('button', { name: 'Resume' }))
      await advance(2_000)

      expect(screen.getByRole('timer')).toHaveTextContent('0:15')
      expect(screen.queryByText('Paused')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    })

    it("shows the next interval's name when the current one ends", async () => {
      const { user } = renderScreen()
      await user.click(screen.getByRole('button', { name: 'Start' }))

      await advance(20_000)

      expect(screen.getByRole('heading', { name: 'Rest' })).toBeInTheDocument()
      expect(screen.getByRole('timer')).toHaveTextContent('0:10')
      expect(screen.getByText('Round 1/1')).toBeInTheDocument()
    })

    it('shows Done and a Restart button when the last interval ends', async () => {
      const { user } = renderScreen()
      await user.click(screen.getByRole('button', { name: 'Start' }))

      await advance(30_000)

      expect(screen.getByRole('heading', { name: 'Done' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Restart' })).toBeInTheDocument()
    })

    it('the Done screen shows neither chip', async () => {
      const { user } = renderScreen()
      await user.click(screen.getByRole('button', { name: 'Start' }))

      await advance(30_000)

      expect(screen.getByRole('heading', { name: 'Done' })).toBeInTheDocument()
      expect(screen.queryByText(/^(Set|Round) \d+\/\d+$/)).not.toBeInTheDocument()
    })
  })

  describe('Reset', () => {
    it('pauses the countdown and shows a "Reset workout?" dialog when Reset is tapped while running', async () => {
      const { user } = renderScreen()
      await user.click(screen.getByRole('button', { name: 'Start' }))
      await advance(3_000)

      await user.click(screen.getByRole('button', { name: 'Reset' }))
      await advance(5_000)

      expect(screen.getByRole('alertdialog', { name: 'Reset workout?' })).toBeInTheDocument()
      expect(screen.getByRole('timer', { hidden: true })).toHaveTextContent('0:17')
    })

    it('returns to the first interval at full duration, idle, when the reset is confirmed', async () => {
      const { user } = renderScreen()
      await user.click(screen.getByRole('button', { name: 'Start' }))
      await advance(25_000)
      await user.click(screen.getByRole('button', { name: 'Reset' }))

      const dialog = screen.getByRole('alertdialog', { name: 'Reset workout?' })
      await user.click(within(dialog).getByRole('button', { name: 'Reset' }))
      await advance(3_000)

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Work' })).toBeInTheDocument()
      expect(screen.getByRole('timer')).toHaveTextContent('0:20')
      expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
    })

    it('keeps counting down from where it was, without counting the dialog time, when the reset is cancelled while running', async () => {
      const { user } = renderScreen()
      await user.click(screen.getByRole('button', { name: 'Start' }))
      await advance(3_000)
      await user.click(screen.getByRole('button', { name: 'Reset' }))
      await advance(10_000)

      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      await advance(2_000)

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(screen.getByRole('timer')).toHaveTextContent('0:15')
      expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    })

    it('stays paused when the reset is cancelled while paused', async () => {
      const { user } = renderScreen()
      await user.click(screen.getByRole('button', { name: 'Start' }))
      await advance(3_000)
      await user.click(screen.getByRole('button', { name: 'Pause' }))
      await user.click(screen.getByRole('button', { name: 'Reset' }))

      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      await advance(5_000)

      expect(screen.getByRole('timer')).toHaveTextContent('0:17')
      expect(screen.getByText('Paused')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument()
    })

    it('hides Reset when idle and when finished', async () => {
      const { user } = renderScreen()
      expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Start' }))
      await advance(30_000)

      expect(screen.getByRole('heading', { name: 'Done' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument()
    })
  })

  describe('Edge cases', () => {
    it("tapping Start twice quickly doesn't start two timers or skip time", async () => {
      const { user } = renderScreen()

      // The second tap lands on the same button, which now reads Pause.
      await user.dblClick(screen.getByRole('button', { name: 'Start' }))
      expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Resume' }))
      await advance(3_000)

      expect(screen.getByRole('timer')).toHaveTextContent('0:17')
    })

    it('pausing at an exact interval boundary resumes into the correct interval', async () => {
      const { user } = renderScreen()
      await user.click(screen.getByRole('button', { name: 'Start' }))
      await advance(20_000)

      await user.click(screen.getByRole('button', { name: 'Pause' }))
      await advance(7_000)
      await user.click(screen.getByRole('button', { name: 'Resume' }))
      await advance(1_000)

      expect(screen.getByRole('heading', { name: 'Rest' })).toBeInTheDocument()
      expect(screen.getByRole('timer')).toHaveTextContent('0:09')
    })
  })

  describe('Mobile scenarios', () => {
    it('shows the correct remaining time after the app is hidden for 45s and becomes visible again', async () => {
      const { user } = renderScreen(
        getMockWorkout({ intervals: [getMockInterval({ durationSec: 60 })] }),
      )
      await user.click(screen.getByRole('button', { name: 'Start' }))
      await advance(5_000)

      hideFor(45_000)

      expect(screen.getByRole('timer')).toHaveTextContent('0:10')
    })

    it('advances through intervals that ended while the app was hidden', async () => {
      const { user } = renderScreen()
      await user.click(screen.getByRole('button', { name: 'Start' }))

      hideFor(25_000)

      expect(screen.getByRole('heading', { name: 'Rest' })).toBeInTheDocument()
      expect(screen.getByRole('timer')).toHaveTextContent('0:05')
      expect(screen.getByText('Round 1/1')).toBeInTheDocument()
    })

    it('stays paused when hidden and shown again while paused', async () => {
      const { user } = renderScreen()
      await user.click(screen.getByRole('button', { name: 'Start' }))
      await advance(3_000)
      await user.click(screen.getByRole('button', { name: 'Pause' }))

      hideFor(60_000)

      expect(screen.getByRole('timer')).toHaveTextContent('0:17')
      expect(screen.getByText('Paused')).toBeInTheDocument()
    })

    it('announces interval changes in the live region, but not every second', async () => {
      const { user } = renderScreen()
      await user.click(screen.getByRole('button', { name: 'Start' }))
      const liveRegion = screen.getByRole('status')
      expect(liveRegion).toHaveTextContent('Work, 20 seconds')

      await advance(5_000)
      expect(liveRegion).toHaveTextContent('Work, 20 seconds')

      await advance(15_000)
      expect(liveRegion).toHaveTextContent('Rest, 10 seconds')

      await advance(10_000)
      expect(liveRegion).toHaveTextContent('Workout complete')
    })
  })

  describe('Empty workout', () => {
    it('disables Start and shows a message for a workout with no intervals', () => {
      renderScreen(getMockWorkout({ intervals: [] }))

      expect(screen.getByText('This workout has no intervals.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled()
      expect(screen.queryByRole('heading', { name: 'Done' })).not.toBeInTheDocument()
    })
  })

  // withPrepare(getMockWorkout()): Prepare 8s, Work 20s, Rest 10s.
  describe('With Prepare', () => {
    const renderPrepared = () => renderScreen(withPrepare(getMockWorkout()))

    it('tapping Start counts down the Prepare screen in whole seconds (7 after 1s)', async () => {
      const { user } = renderPrepared()
      await user.click(screen.getByRole('button', { name: 'Start' }))

      await advance(1_000)

      expect(screen.getByRole('heading', { name: 'Prepare' })).toBeInTheDocument()
      expect(screen.getByRole('timer')).toHaveTextContent(/^7$/)
    })

    it('Work starts with 0:20 when Prepare ends after 8s', async () => {
      const { user } = renderPrepared()
      await user.click(screen.getByRole('button', { name: 'Start' }))

      await advance(8_000)

      expect(screen.getByRole('heading', { name: 'Work' })).toBeInTheDocument()
      expect(screen.getByRole('timer')).toHaveTextContent('0:20')
    })

    it('Restart after Done begins at the Prepare screen at 8 again', async () => {
      const { user } = renderPrepared()
      await user.click(screen.getByRole('button', { name: 'Start' }))
      await advance(38_000)
      expect(screen.getByRole('heading', { name: 'Done' })).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Restart' }))

      expect(screen.getByRole('heading', { name: 'Prepare' })).toBeInTheDocument()
      expect(screen.getByRole('timer')).toHaveTextContent(/^8$/)
    })

    it('confirming Reset during Work returns to the Prepare screen at 8, idle', async () => {
      const { user } = renderPrepared()
      await user.click(screen.getByRole('button', { name: 'Start' }))
      await advance(12_000) // Work 0:16
      await user.click(screen.getByRole('button', { name: 'Reset' }))

      const dialog = screen.getByRole('alertdialog', { name: 'Reset workout?' })
      await user.click(within(dialog).getByRole('button', { name: 'Reset' }))

      expect(screen.getByRole('heading', { name: 'Prepare' })).toBeInTheDocument()
      expect(screen.getByRole('timer')).toHaveTextContent(/^8$/)
      expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
    })

    it('pausing during Prepare freezes it, and Resume continues Prepare without counting the paused time', async () => {
      const { user } = renderPrepared()
      await user.click(screen.getByRole('button', { name: 'Start' }))
      await advance(3_000) // Prepare 5
      await user.click(screen.getByRole('button', { name: 'Pause' }))
      await advance(30_000)
      expect(screen.getByRole('timer')).toHaveTextContent(/^5$/)

      await user.click(screen.getByRole('button', { name: 'Resume' }))
      await advance(2_000)

      expect(screen.getByRole('heading', { name: 'Prepare' })).toBeInTheDocument()
      expect(screen.getByRole('timer')).toHaveTextContent(/^3$/)
    })

    it('announces "Prepare, 8 seconds" in the live region when Start is tapped', async () => {
      const { user } = renderPrepared()

      await user.click(screen.getByRole('button', { name: 'Start' }))

      expect(screen.getByRole('status')).toHaveTextContent('Prepare, 8 seconds')
    })

    it('counts the Prepare screen down to 1 in its last second', async () => {
      const { user } = renderPrepared()
      await user.click(screen.getByRole('button', { name: 'Start' }))

      await advance(7_000)

      expect(screen.getByRole('timer')).toHaveTextContent(/^1$/)
    })

    it('after Prepare ends, the normal Work screen shows 0:20 and no "Next" line', async () => {
      const { user } = renderPrepared()
      expect(screen.getByText('Next: Work · 0:20')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Start' }))

      await advance(8_000)

      expect(screen.getByRole('timer')).toHaveTextContent('0:20')
      expect(screen.queryByText(/^Next:/)).not.toBeInTheDocument()
    })

    it('the Rest screen has no "Next" line', async () => {
      const workout = getMockWorkout()
      workout.intervals.push(getMockInterval({ id: 'work-2' })) // Rest is followed by Work
      const { user } = renderScreen(withPrepare(workout))
      await user.click(screen.getByRole('button', { name: 'Start' }))

      await advance(28_000)

      expect(screen.getByRole('heading', { name: 'Rest' })).toBeInTheDocument()
      expect(screen.queryByText(/^Next:/)).not.toBeInTheDocument()
    })

    it('pausing on the Prepare screen shows "Paused" and Resume on the Prepare screen', async () => {
      const { user } = renderPrepared()
      await user.click(screen.getByRole('button', { name: 'Start' }))
      await advance(2_000)

      await user.click(screen.getByRole('button', { name: 'Pause' }))

      expect(screen.getByRole('heading', { name: 'Prepare' })).toBeInTheDocument()
      expect(screen.getByText('Next: Work · 0:20')).toBeInTheDocument()
      expect(screen.getByText('Paused')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument()
    })

    it('Reset is available on the Prepare screen while it counts down', async () => {
      const { user } = renderPrepared()
      await user.click(screen.getByRole('button', { name: 'Start' }))
      await advance(1_000)

      expect(screen.getByRole('heading', { name: 'Prepare' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument()
    })
  })
})
