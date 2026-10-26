import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { getMockSession } from '../test/factories.ts'
import { renderWithProviders } from '../test/render.tsx'
import HistoryScreen from './HistoryScreen.tsx'
import type { WorkoutSession } from './history.ts'

const at = (day: number, hour = 7) => new Date(2026, 9, day, hour).getTime()
const NOW = at(26, 18) // Mon 26 Oct 2026

// Today: two workouts (8m 18s + 1m 00s); 3 days ago: 10m; 20 days ago: 5m.
const SESSIONS = [
  getMockSession({ startedAt: at(26, 7) }),
  getMockSession({ startedAt: at(26, 12), activeMs: 60_000 }),
  getMockSession({ startedAt: at(23), activeMs: 600_000 }),
  getMockSession({ startedAt: at(6), activeMs: 300_000 }),
]

const renderHistory = (sessions: WorkoutSession[] = SESSIONS) => {
  const onBack = vi.fn()
  const view = renderWithProviders(<HistoryScreen sessions={sessions} onBack={onBack} now={NOW} />)
  return { ...view, onBack }
}

const stat = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling
const chart = () => screen.getByLabelText(/^Daily workout time/)
const readout = () => document.getElementById('history-readout')

describe('HistoryScreen', () => {
  it('shows the last 7 days by default: total, workouts and daily average', () => {
    renderHistory()

    expect(screen.getByRole('heading', { name: 'Workout History' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '7 days' })).toHaveAttribute('aria-pressed', 'true')
    expect(stat('Total')).toHaveTextContent('19m 18s')
    expect(stat('Workouts')).toHaveTextContent('3')
    expect(stat('Daily average')).toHaveTextContent('2m 45s')
  })

  it('switching to 30 days includes older workouts and redraws the chart with 30 days', async () => {
    const { user } = renderHistory()

    await user.click(screen.getByRole('button', { name: '30 days' }))

    expect(screen.getByRole('button', { name: '30 days' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '7 days' })).toHaveAttribute('aria-pressed', 'false')
    expect(stat('Total')).toHaveTextContent('24m 18s')
    expect(stat('Workouts')).toHaveTextContent('4')
    expect(chart().children).toHaveLength(30)
  })

  it('draws a bar only for days with a workout', () => {
    renderHistory()

    expect(chart().children).toHaveLength(7)
    expect(chart().querySelectorAll('.history__bar-mark')).toHaveLength(2)
  })

  it('with no workouts in the range, says so and offers no table', () => {
    renderHistory([getMockSession({ startedAt: at(6) })])

    expect(screen.getByText('No workouts in the last 7 days.')).toBeInTheDocument()
    expect(stat('Total')).toHaveTextContent('0s')
    expect(screen.queryByText('Daily totals')).not.toBeInTheDocument()
  })

  describe('reading one day', () => {
    it('starts with a hint', () => {
      renderHistory()

      expect(readout()).toHaveTextContent('Tap a day to see its total')
    })

    it('tapping the chart reads out the day under the finger', () => {
      renderHistory()
      vi.spyOn(chart(), 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 700, 200))

      fireEvent.pointerDown(chart(), { clientX: 650, pointerId: 1 }) // the 7th slot: today

      expect(readout()).toHaveTextContent(/^9m 18s.*· 2 workouts$/)
    })

    it('the arrow keys move the day, starting from today', async () => {
      const { user } = renderHistory()
      chart().focus()

      await user.keyboard('{ArrowLeft}')
      expect(readout()).toHaveTextContent(/^9m 18s/) // today
      await user.keyboard('{ArrowLeft}')
      expect(readout()).toHaveTextContent(/^0s/) // yesterday, no workout
      await user.keyboard('{ArrowLeft}{ArrowLeft}')
      expect(readout()).toHaveTextContent(/^10m 00s.*· 1 workout$/)
    })

    it('changing the range clears the picked day', async () => {
      const { user } = renderHistory()
      chart().focus()
      await user.keyboard('{ArrowLeft}')

      await user.click(screen.getByRole('button', { name: '30 days' }))

      expect(readout()).toHaveTextContent('Tap a day to see its total')
    })
  })

  describe('custom date range', () => {
    const from = () => screen.getByLabelText('From')
    const to = () => screen.getByLabelText('To')
    const setDate = (input: HTMLElement, value: string) => fireEvent.change(input, { target: { value } })

    it('Custom shows From and To filled with the days already shown, up to today', async () => {
      const { user } = renderHistory()

      await user.click(screen.getByRole('button', { name: 'Custom' }))

      expect(screen.getByRole('button', { name: 'Custom' })).toHaveAttribute('aria-pressed', 'true')
      expect(from()).toHaveValue('2026-10-20')
      expect(to()).toHaveValue('2026-10-26')
      expect(to()).toHaveAttribute('max', '2026-10-26')
      expect(stat('Total')).toHaveTextContent('19m 18s')
    })

    it('choosing dates shows only those days, with both ends labelled', async () => {
      const { user } = renderHistory()
      await user.click(screen.getByRole('button', { name: 'Custom' }))

      setDate(from(), '2026-10-01')
      setDate(to(), '2026-10-23')

      expect(chart().children).toHaveLength(23)
      expect(stat('Total')).toHaveTextContent('15m 00s') // 6 Oct + 23 Oct
      expect(stat('Workouts')).toHaveTextContent('2')
      expect(stat('Daily average')).toHaveTextContent('39s')
      expect(screen.queryByText('Today')).not.toBeInTheDocument()
    })

    it('a range with no workouts names its dates', async () => {
      const { user } = renderHistory()
      await user.click(screen.getByRole('button', { name: 'Custom' }))

      setDate(from(), '2026-10-10')
      setDate(to(), '2026-10-12')

      expect(screen.getByText(/^No workouts from .+ to .+\.$/)).toBeInTheDocument()
    })

    it('an invalid range shows its error on the field and keeps the last valid range on the chart', async () => {
      const { user } = renderHistory()
      await user.click(screen.getByRole('button', { name: 'Custom' }))
      setDate(from(), '2026-10-01')

      setDate(from(), '2026-10-27')

      expect(from()).toHaveAccessibleDescription('Start must be on or before the end.')
      expect(from()).toHaveAttribute('aria-invalid', 'true')
      expect(chart().children).toHaveLength(26) // still 1–26 Oct

      setDate(from(), '2026-10-25')
      expect(from()).not.toHaveAccessibleDescription()
      expect(chart().children).toHaveLength(2)
    })

    it('over 90 days is refused', async () => {
      const { user } = renderHistory()
      await user.click(screen.getByRole('button', { name: 'Custom' }))

      setDate(from(), '2026-07-01')

      expect(screen.getByRole('alert')).toHaveTextContent('Choose a range of up to 90 days.')
    })

    it('going back to a preset hides the date fields', async () => {
      const { user } = renderHistory()
      await user.click(screen.getByRole('button', { name: 'Custom' }))

      await user.click(screen.getByRole('button', { name: '30 days' }))

      expect(screen.queryByLabelText('From')).not.toBeInTheDocument()
      expect(chart().children).toHaveLength(30)
    })
  })

  it('the Daily totals table lists only days with workouts, newest first', async () => {
    const { user } = renderHistory()

    await user.click(screen.getByText('Daily totals'))

    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent(/2\s*9m 18s$/)
    expect(rows[1]).toHaveTextContent(/1\s*10m 00s$/)
  })

  it('the back arrow calls onBack', async () => {
    const { user, onBack } = renderHistory()

    await user.click(screen.getByRole('button', { name: 'Back' }))

    expect(onBack).toHaveBeenCalled()
  })
})
