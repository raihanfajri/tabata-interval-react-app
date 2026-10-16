import { act, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getMockWorkout } from '../test/factories.ts'
import { FakeAudioContext } from '../test/fakeAudio.ts'
import { renderWithProviders } from '../test/render.tsx'
import IntervalTimerScreen from './IntervalTimerScreen.tsx'
import { withPrepare, withSets } from './intervals.ts'
import { saveTimer } from './persistence.ts'
import { buildWorkout, DEFAULT_SETTINGS } from './settings.ts'
import * as sounds from './sounds.ts'

// getMockWorkout(): Work 20s, then Rest 10s.
const openApp = (workout = getMockWorkout()) =>
  renderWithProviders(<IntervalTimerScreen workout={workout} />, {
    advanceTimers: vi.advanceTimersByTime,
  })

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))

// Closing the app: the screen goes away and no timers run until it reopens.
const closeFor = (app: ReturnType<typeof openApp>, ms: number) => {
  app.unmount()
  vi.setSystemTime(Date.now() + ms)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('IntervalTimerScreen: closed and reopened', () => {
  it('reopening with a timer saved under the old name (workout ending with a Rest) opens a fresh workout at Prepare', () => {
    const workout = buildWorkout(DEFAULT_SETTINGS)
    saveTimer({ ...workout, name: 'Custom 8/20/10/30 · 2×8' }, { startedAt: Date.now() - 60_000, pausedAt: null, pausedTotalMs: 0 })

    openApp(workout)

    expect(screen.getByRole('heading', { name: 'Prepare' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
  })

  it('reopening a workout that was running at 0:15 and closed for 5s shows 0:10, still running', async () => {
    const app = openApp()
    await app.user.click(screen.getByRole('button', { name: 'Start' }))
    await advance(5_000)

    closeFor(app, 5_000)
    openApp()

    expect(screen.getByRole('timer')).toHaveTextContent('0:10')
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    await advance(1_000)
    expect(screen.getByRole('timer')).toHaveTextContent('0:09')
  })

  it('reopening a workout that was paused at 0:17 shows it paused at 0:17', async () => {
    const app = openApp()
    await app.user.click(screen.getByRole('button', { name: 'Start' }))
    await advance(3_000)
    await app.user.click(screen.getByRole('button', { name: 'Pause' }))

    closeFor(app, 60_000)
    openApp()

    expect(screen.getByRole('timer')).toHaveTextContent('0:17')
    expect(screen.getByText('Paused')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument()
  })

  it('reopening after the workout would have ended shows Done, and the following open starts fresh', async () => {
    const app = openApp()
    await app.user.click(screen.getByRole('button', { name: 'Start' }))
    await advance(5_000)

    closeFor(app, 60_000)
    const reopened = openApp()
    expect(screen.getByRole('heading', { name: 'Done' })).toBeInTheDocument()

    closeFor(reopened, 1_000)
    openApp()
    expect(screen.getByRole('heading', { name: 'Work' })).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('0:20')
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
  })

  it('reopening after a confirmed Reset starts fresh', async () => {
    const app = openApp()
    await app.user.click(screen.getByRole('button', { name: 'Start' }))
    await advance(5_000)
    await app.user.click(screen.getByRole('button', { name: 'Reset' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Reset workout?' })
    await app.user.click(within(dialog).getByRole('button', { name: 'Reset' }))

    closeFor(app, 5_000)
    openApp()

    expect(screen.getByRole('timer')).toHaveTextContent('0:20')
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
  })

  it('reopening at 0:02 does not replay the cues skipped while closed, and still cues 0:01', async () => {
    const vibrate = vi.fn(() => true)
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate })
    const app = openApp()
    await app.user.click(screen.getByRole('button', { name: 'Start' }))
    await advance(5_000) // Work 0:15

    closeFor(app, 13_000) // reopens at Work 0:02
    openApp()
    expect(screen.getByRole('timer')).toHaveTextContent('0:02')
    expect(vibrate).not.toHaveBeenCalled()

    await advance(1_000) // Work 0:01
    expect(vibrate).toHaveBeenCalledOnce()
    Reflect.deleteProperty(navigator, 'vibrate')
  })

  it('closing the app during Prepare and reopening 10s later shows Work at 0:18, with no whistle replayed', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext)
    const whistle = vi.spyOn(sounds, 'playWhistle')
    const prepared = withPrepare(getMockWorkout()) // Prepare 8s, Work 20s, Rest 10s
    const app = openApp(prepared)
    await app.user.click(screen.getByRole('button', { name: 'Start' }))
    await advance(0) // Prepare 0:08

    closeFor(app, 10_000) // Prepare ended 2s before reopening
    openApp(prepared)
    await advance(0)

    expect(screen.getByRole('heading', { name: 'Work' })).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('0:18')
    expect(whistle).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it("closing the app 10s into the break and reopening 25s later shows set 2's first Work at 0:15", async () => {
    const sets = withSets(getMockWorkout(), { sets: 2, restBetweenSec: 30 }) // Work 20, break 30, Work 20, Rest 10
    const app = openApp(sets)
    await app.user.click(screen.getByRole('button', { name: 'Start' }))
    await advance(30_000) // 10s into the break
    expect(screen.getByRole('heading', { name: 'Rest between sets' })).toBeInTheDocument()

    closeFor(app, 25_000)
    openApp(sets)

    expect(screen.getByRole('heading', { name: 'Work' })).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('0:15')
    expect(screen.getByText('Set 2/2')).toBeInTheDocument()
  })
})
