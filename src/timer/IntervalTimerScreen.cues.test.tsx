import { act, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getMockInterval, getMockWorkout } from '../test/factories.ts'
import { renderWithProviders } from '../test/render.tsx'
import { FakeAudioContext } from '../test/fakeAudio.ts'
import IntervalTimerScreen from './IntervalTimerScreen.tsx'
import { withPrepare, withSets } from './intervals.ts'
import { buildWorkout, DEFAULT_SETTINGS } from './settings.ts'
import { playBeep, playBell, playWhistle } from './sounds.ts'

// The sounds themselves are covered in sounds.test.ts; here we only check which
// sound plays when.
vi.mock('./sounds.ts', () => ({ playBeep: vi.fn(), playWhistle: vi.fn(), playBell: vi.fn() }))

const beepCount = () => vi.mocked(playBeep).mock.calls.length
const whistleCount = () => vi.mocked(playWhistle).mock.calls.length
const bellCount = () => vi.mocked(playBell).mock.calls.length

let vibrate: ReturnType<typeof vi.fn>

// getMockWorkout(): Work 20s, then Rest 10s.
const renderScreen = (workout = getMockWorkout()) =>
  renderWithProviders(<IntervalTimerScreen workout={workout} />, {
    advanceTimers: vi.advanceTimersByTime,
  })

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))

// Android throttles timers while hidden: move the clock without firing ticks.
const hideFor = (ms: number) => {
  for (const state of ['hidden', 'visible'] as const) {
    if (state === 'visible') vi.setSystemTime(Date.now() + ms)
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: state })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  FakeAudioContext.instances = []
  vi.stubGlobal('AudioContext', FakeAudioContext)
  vibrate = vi.fn(() => true)
  Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'vibrate')
  Reflect.deleteProperty(document, 'visibilityState')
})

describe('IntervalTimerScreen: countdown cues', () => {
  it('beeps and vibrates once when an interval reaches 0:03', async () => {
    const { user } = renderScreen()
    await user.click(screen.getByRole('button', { name: 'Start' }))

    await advance(16_999)
    expect(screen.getByRole('timer')).toHaveTextContent('0:04')
    expect(beepCount()).toBe(0)
    expect(vibrate).not.toHaveBeenCalled()

    await advance(1)
    expect(screen.getByRole('timer')).toHaveTextContent('0:03')
    expect(beepCount()).toBe(1)
    expect(vibrate).toHaveBeenCalledOnce()
  })

  it('beeps and vibrates at 0:03, 0:02 and 0:01 of every interval, 6 times in total, never above 0:03 or at 0:00', async () => {
    const { user } = renderScreen()
    await user.click(screen.getByRole('button', { name: 'Start' }))

    await advance(19_999) // Work 0:01
    expect(beepCount()).toBe(3)
    await advance(1) // Rest 0:10 — the interval change itself is silent
    expect(screen.getByRole('heading', { name: 'Rest' })).toBeInTheDocument()
    expect(beepCount()).toBe(3)
    await advance(6_999) // Rest 0:04
    expect(beepCount()).toBe(3)
    await advance(3_001) // Done
    expect(screen.getByRole('heading', { name: 'Done' })).toBeInTheDocument()

    expect(beepCount()).toBe(6)
    expect(vibrate).toHaveBeenCalledTimes(6)
    expect(vibrate).toHaveBeenCalledWith(100)
  })

  it('prepares the audio during the Start tap, before any cue is due', async () => {
    const { user } = renderScreen()

    await user.click(screen.getByRole('button', { name: 'Start' }))

    expect(FakeAudioContext.instances).toHaveLength(1)
    expect(FakeAudioContext.instances[0].resume).toHaveBeenCalledOnce()
    expect(beepCount()).toBe(0)
  })

  it('does not repeat the 0:02 cue after pausing at 0:02 and resuming, and still cues 0:01', async () => {
    const { user } = renderScreen()
    await user.click(screen.getByRole('button', { name: 'Start' }))
    await advance(18_000) // Work 0:02: cues at 3 and 2
    expect(beepCount()).toBe(2)

    await user.click(screen.getByRole('button', { name: 'Pause' }))
    await advance(5_000)
    await user.click(screen.getByRole('button', { name: 'Resume' }))
    expect(beepCount()).toBe(2)

    await advance(1_000) // Work 0:01
    expect(beepCount()).toBe(3)
    expect(vibrate).toHaveBeenCalledTimes(3)
  })

  it('does not replay skipped cues when the app returns from the background at 0:02, and still cues 0:01', async () => {
    const { user } = renderScreen()
    await user.click(screen.getByRole('button', { name: 'Start' }))
    await advance(10_000) // Work 0:10

    hideFor(8_000) // back at Work 0:02
    expect(screen.getByRole('timer')).toHaveTextContent('0:02')
    expect(beepCount()).toBe(0)
    expect(vibrate).not.toHaveBeenCalled()

    await advance(1_000) // Work 0:01
    expect(beepCount()).toBe(1)
    expect(vibrate).toHaveBeenCalledOnce()
  })

  it('keeps counting down and still vibrates when the browser has no Web Audio', async () => {
    vi.stubGlobal('AudioContext', undefined)
    Reflect.deleteProperty(window, 'AudioContext')
    const { user } = renderScreen()
    await user.click(screen.getByRole('button', { name: 'Start' }))

    await advance(18_000)

    expect(screen.getByRole('timer')).toHaveTextContent('0:02')
    expect(vibrate).toHaveBeenCalledTimes(2)
  })

  it('keeps counting down and still beeps when the browser has no vibration', async () => {
    Reflect.deleteProperty(navigator, 'vibrate')
    const { user } = renderScreen()
    await user.click(screen.getByRole('button', { name: 'Start' }))

    await advance(18_000)

    expect(screen.getByRole('timer')).toHaveTextContent('0:02')
    expect(beepCount()).toBe(2)
  })
})

describe('IntervalTimerScreen: transition sounds', () => {
  it('plays the whistle when Start is tapped', async () => {
    const { user } = renderScreen()

    await user.click(screen.getByRole('button', { name: 'Start' }))

    expect(whistleCount()).toBe(1)
    expect(bellCount()).toBe(0)
  })

  it('plays the bell when Work ends and Rest begins', async () => {
    const { user } = renderScreen()
    await user.click(screen.getByRole('button', { name: 'Start' }))

    await advance(19_999)
    expect(bellCount()).toBe(0)
    await advance(1)

    expect(screen.getByRole('heading', { name: 'Rest' })).toBeInTheDocument()
    expect(bellCount()).toBe(1)
    expect(whistleCount()).toBe(1) // only the one from Start
  })

  it('plays the whistle when Rest ends and the next Work begins', async () => {
    const workout = getMockWorkout()
    workout.intervals.push(getMockInterval({ id: 'work-2' })) // Work 20s, Rest 10s, Work 20s
    const { user } = renderScreen(workout)
    await user.click(screen.getByRole('button', { name: 'Start' }))

    await advance(30_000)

    expect(screen.getByRole('heading', { name: 'Work' })).toBeInTheDocument()
    expect(screen.getByText('Round 2/2')).toBeInTheDocument()
    expect(whistleCount()).toBe(2) // Start + Rest→Work
    expect(bellCount()).toBe(1) // Work→Rest
  })

  it('plays the bell when the last interval ends and the workout is Done', async () => {
    const { user } = renderScreen()
    await user.click(screen.getByRole('button', { name: 'Start' }))

    await advance(30_000)

    expect(screen.getByRole('heading', { name: 'Done' })).toBeInTheDocument()
    expect(bellCount()).toBe(2) // Work→Rest, Rest→Done
  })

  it('plays the bell once when the last Work ends and the workout is Done', async () => {
    const { user } = renderScreen(buildWorkout({ ...DEFAULT_SETTINGS, prepareSec: 0, sets: 1, cycles: 1 }))
    await user.click(screen.getByRole('button', { name: 'Start' }))

    await advance(20_000)

    expect(screen.getByRole('heading', { name: 'Done' })).toBeInTheDocument()
    expect(bellCount()).toBe(1) // Work→Done
  })

  it('plays the whistle when Restart is tapped after Done', async () => {
    const { user } = renderScreen()
    await user.click(screen.getByRole('button', { name: 'Start' }))
    await advance(30_000)

    await user.click(screen.getByRole('button', { name: 'Restart' }))

    expect(whistleCount()).toBe(2) // Start + Restart
  })

  it('plays nothing when Resume is tapped', async () => {
    const { user } = renderScreen()
    await user.click(screen.getByRole('button', { name: 'Start' }))
    await advance(3_000)
    await user.click(screen.getByRole('button', { name: 'Pause' }))

    await user.click(screen.getByRole('button', { name: 'Resume' }))
    await advance(0)

    expect(whistleCount()).toBe(1) // only the one from Start
    expect(bellCount()).toBe(0)
  })

  it('does not play a transition sound for an interval change skipped while the app was hidden', async () => {
    const { user } = renderScreen()
    await user.click(screen.getByRole('button', { name: 'Start' }))
    await advance(15_000) // Work 0:05

    hideFor(7_000) // back at Rest 0:08
    expect(screen.getByRole('heading', { name: 'Rest' })).toBeInTheDocument()
    await advance(1_000)

    expect(bellCount()).toBe(0)
  })
})

// withPrepare(getMockWorkout()): Prepare 8s, Work 20s, Rest 10s.
describe('IntervalTimerScreen: Prepare sounds', () => {
  const renderPrepared = () => renderScreen(withPrepare(getMockWorkout()))

  it('plays no sound when Start is tapped (Prepare begins silently)', async () => {
    const { user } = renderPrepared()

    await user.click(screen.getByRole('button', { name: 'Start' }))
    await advance(0)

    expect(whistleCount()).toBe(0)
    expect(bellCount()).toBe(0)
    expect(beepCount()).toBe(0)
  })

  it("beeps and vibrates at Prepare's 0:03, 0:02 and 0:01", async () => {
    const { user } = renderPrepared()
    await user.click(screen.getByRole('button', { name: 'Start' }))

    await advance(4_999) // Prepare 0:04
    expect(beepCount()).toBe(0)
    await advance(3_000) // Prepare 0:01

    expect(screen.getByRole('heading', { name: 'Prepare' })).toBeInTheDocument()
    expect(beepCount()).toBe(3)
    expect(vibrate).toHaveBeenCalledTimes(3)
  })

  it('plays the whistle when Prepare ends and Work begins', async () => {
    const { user } = renderPrepared()
    await user.click(screen.getByRole('button', { name: 'Start' }))

    await advance(8_000)

    expect(screen.getByRole('heading', { name: 'Work' })).toBeInTheDocument()
    expect(whistleCount()).toBe(1)
  })

  it('Restart after Done begins at Prepare again, silently', async () => {
    const { user } = renderPrepared()
    await user.click(screen.getByRole('button', { name: 'Start' }))
    await advance(38_000)
    const whistlesBefore = whistleCount()
    const bellsBefore = bellCount()

    await user.click(screen.getByRole('button', { name: 'Restart' }))
    await advance(0)

    expect(screen.getByRole('heading', { name: 'Prepare' })).toBeInTheDocument()
    expect(whistleCount()).toBe(whistlesBefore)
    expect(bellCount()).toBe(bellsBefore)
  })
})

// withSets(getMockWorkout(), 2 sets, 30s): Work 20s, break 30s, Work 20s, Rest 10s.
describe('IntervalTimerScreen: rest between sets sounds', () => {
  const renderSets = () => renderScreen(withSets(getMockWorkout(), { sets: 2, restBetweenSec: 30 }))

  it('plays the bell when the break begins, and the whistle when set 2 begins', async () => {
    const { user } = renderSets()
    await user.click(screen.getByRole('button', { name: 'Start' }))

    await advance(20_000) // into the break
    expect(screen.getByRole('heading', { name: 'Rest between sets' })).toBeInTheDocument()
    expect(bellCount()).toBe(1)
    expect(whistleCount()).toBe(1) // only the one from Start

    await advance(30_000) // into set 2's Work
    expect(screen.getByRole('heading', { name: 'Work' })).toBeInTheDocument()
    expect(whistleCount()).toBe(2)
  })

  it("beeps and vibrates at the break's 0:03, 0:02 and 0:01", async () => {
    const { user } = renderSets()
    await user.click(screen.getByRole('button', { name: 'Start' }))
    await advance(20_000) // break starts (Work's 3 beeps already played)
    expect(beepCount()).toBe(3)

    await advance(29_999) // break 0:01

    expect(screen.getByRole('heading', { name: 'Rest between sets' })).toBeInTheDocument()
    expect(beepCount()).toBe(6)
    expect(vibrate).toHaveBeenCalledTimes(6)
  })
})

describe('IntervalTimerScreen: Prepare 0 and Rest 0', () => {
  it('Start goes straight to Work, Work follows Work, and the whistle plays at each Work change with no bells in between', async () => {
    // One set of 3 cycles, no Prepare, no Rest: Work 20s × 3.
    const workout = buildWorkout({ ...DEFAULT_SETTINGS, prepareSec: 0, restSec: 0, sets: 1, cycles: 3 })
    const { user } = renderScreen(workout)

    await user.click(screen.getByRole('button', { name: 'Start' }))
    expect(screen.getByRole('heading', { name: 'Work' })).toBeInTheDocument()
    expect(screen.getByText('Round 1/3')).toBeInTheDocument()
    expect(whistleCount()).toBe(1)

    await advance(20_000)
    expect(screen.getByText('Round 2/3')).toBeInTheDocument()
    await advance(20_000)
    expect(screen.getByText('Round 3/3')).toBeInTheDocument()

    expect(whistleCount()).toBe(3)
    expect(bellCount()).toBe(0)
  })
})
