import { act, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getMockWorkout } from '../test/factories.ts'
import { renderWithProviders } from '../test/render.tsx'
import IntervalTimerScreen from './IntervalTimerScreen.tsx'

// A fake WakeLockSentinel; `released` flips when the app or the system releases it.
const createSentinel = () => {
  const sentinel = {
    released: false,
    release: vi.fn(async () => {
      sentinel.released = true
    }),
  }
  return sentinel
}

let sentinels: ReturnType<typeof createSentinel>[]
let request: ReturnType<typeof vi.fn>

const stubWakeLock = () => {
  sentinels = []
  request = vi.fn(async () => {
    const sentinel = createSentinel()
    sentinels.push(sentinel)
    return sentinel
  })
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } })
}

// getMockWorkout(): Work 20s, then Rest 10s.
const renderScreen = () =>
  renderWithProviders(<IntervalTimerScreen workout={getMockWorkout()} />, {
    advanceTimers: vi.advanceTimersByTime,
  })

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))

// Android releases wake locks when the app is hidden; this mimics that.
const hideAndReturn = async () => {
  for (const state of ['hidden', 'visible'] as const) {
    if (state === 'hidden') sentinels.forEach((s) => (s.released = true))
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: state })
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  stubWakeLock()
})

afterEach(() => {
  vi.useRealTimers()
  Reflect.deleteProperty(navigator, 'wakeLock')
  Reflect.deleteProperty(document, 'visibilityState')
})

describe('IntervalTimerScreen: keep screen awake', () => {
  it('requests a screen wake lock when Start is tapped', async () => {
    const { user } = renderScreen()
    expect(request).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Start' }))
    await advance(0)

    expect(request).toHaveBeenCalledOnce()
    expect(request).toHaveBeenCalledWith('screen')
  })

  it('releases the wake lock when Pause is tapped, and requests it again on Resume', async () => {
    const { user } = renderScreen()
    await user.click(screen.getByRole('button', { name: 'Start' }))
    await advance(0)

    await user.click(screen.getByRole('button', { name: 'Pause' }))
    await advance(0)
    expect(sentinels[0].release).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: 'Resume' }))
    await advance(0)
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('releases the wake lock when the workout finishes', async () => {
    const { user } = renderScreen()
    await user.click(screen.getByRole('button', { name: 'Start' }))

    await advance(30_000)

    expect(screen.getByRole('heading', { name: 'Done' })).toBeInTheDocument()
    expect(sentinels[0].release).toHaveBeenCalledOnce()
  })

  it('releases the wake lock when the Reset dialog pauses the timer', async () => {
    const { user } = renderScreen()
    await user.click(screen.getByRole('button', { name: 'Start' }))
    await advance(0)

    await user.click(screen.getByRole('button', { name: 'Reset' }))
    await advance(0)

    expect(sentinels[0].release).toHaveBeenCalledOnce()
  })

  it('releases the wake lock when the screen is removed (unmount)', async () => {
    const { user, unmount } = renderScreen()
    await user.click(screen.getByRole('button', { name: 'Start' }))
    await advance(0)

    unmount()

    expect(sentinels[0].release).toHaveBeenCalledOnce()
  })

  it('requests the wake lock again when the app returns to the foreground while running (Android released it while hidden)', async () => {
    const { user } = renderScreen()
    await user.click(screen.getByRole('button', { name: 'Start' }))
    await advance(0)

    await hideAndReturn()

    expect(request).toHaveBeenCalledTimes(2)
  })

  it('does not request the wake lock on return to the foreground while paused', async () => {
    const { user } = renderScreen()
    await user.click(screen.getByRole('button', { name: 'Start' }))
    await advance(0)
    await user.click(screen.getByRole('button', { name: 'Pause' }))
    await advance(0)

    await hideAndReturn()

    expect(request).toHaveBeenCalledOnce()
  })

  it('keeps counting down normally when the browser has no Wake Lock API', async () => {
    Reflect.deleteProperty(navigator, 'wakeLock')
    const { user } = renderScreen()

    await user.click(screen.getByRole('button', { name: 'Start' }))
    await advance(3_000)

    expect(screen.getByRole('timer')).toHaveTextContent('0:17')
  })

  it('keeps counting down normally when the wake lock request is refused', async () => {
    request.mockRejectedValue(new DOMException('Battery saver is on', 'NotAllowedError'))
    const { user } = renderScreen()

    await user.click(screen.getByRole('button', { name: 'Start' }))
    await advance(3_000)

    expect(request).toHaveBeenCalledOnce()
    expect(screen.getByRole('timer')).toHaveTextContent('0:17')
  })
})
