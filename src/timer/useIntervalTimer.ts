import { useEffect, useEffectEvent, useState } from 'react'
import { getTimerState, type TimerState, type Workout } from './intervals.ts'
import { clearTimer, loadTimer, saveTimer } from './persistence.ts'

export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished'

// `onTime` is called with the timer state every time the running timer reads
// the clock (each tick, and when catching up after the app was hidden). It runs
// from the timers themselves, not from rendering, so it sees every second.
export function useIntervalTimer(workout: Workout, onTime?: (state: TimerState) => void) {
  // Restore a workout saved before the app was closed; time kept counting meanwhile.
  const [saved] = useState(() => loadTimer(workout))
  const [startedAt, setStartedAt] = useState<number | null>(saved?.startedAt ?? null)
  const [pausedAt, setPausedAt] = useState<number | null>(saved?.pausedAt ?? null)
  const [pausedTotalMs, setPausedTotalMs] = useState(saved?.pausedTotalMs ?? 0)
  const [now, setNow] = useState(() => Date.now())

  const elapsedMs =
    startedAt === null ? 0 : (pausedAt ?? now) - startedAt - pausedTotalMs
  const state = getTimerState(workout, elapsedMs)
  const status: TimerStatus =
    startedAt === null
      ? 'idle'
      : state.finished
        ? 'finished'
        : pausedAt !== null
          ? 'paused'
          : 'running'
  const ticking = status === 'running'

  const observe = useEffectEvent((t: number) => {
    if (!ticking || startedAt === null) return
    onTime?.(getTimerState(workout, t - startedAt - pausedTotalMs))
  })

  // The tick only triggers a re-render; time always comes from Date.now().
  // Each tick is scheduled for the next whole second of elapsed time, which is
  // when the displayed (whole-second) remaining time changes, so it never drifts.
  useEffect(() => {
    if (!ticking || startedAt === null) return
    const delayFrom = (t: number) => 1000 - ((t - startedAt - pausedTotalMs) % 1000)
    let id: ReturnType<typeof setTimeout>
    const tick = () => {
      const t = Date.now()
      setNow(t)
      observe(t)
      id = setTimeout(tick, delayFrom(t))
    }
    // Report the starting reading too (Start, Resume, or reopening the app), so
    // the first second ticked through has a reading to compare against.
    const t0 = Date.now()
    observe(t0)
    id = setTimeout(tick, delayFrom(t0))
    return () => clearTimeout(id)
  }, [ticking, startedAt, pausedTotalMs])

  const finished = status === 'finished'
  useEffect(() => {
    // Idle (reset) saves nothing. A finished workout is shown once (e.g. it ended
    // while the app was closed), then forgotten so the next open starts fresh.
    if (startedAt === null || finished) clearTimer(workout)
    else saveTimer(workout, { startedAt, pausedAt, pausedTotalMs })
  }, [workout, finished, startedAt, pausedAt, pausedTotalMs])

  // Background timers are throttled or frozen, so catch up on return.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      const t = Date.now()
      setNow(t)
      observe(t)
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  const start = () => {
    const t = Date.now()
    setStartedAt(t)
    setPausedAt(null)
    setPausedTotalMs(0)
    setNow(t)
  }

  const pause = () => {
    setPausedAt(Date.now())
  }

  const resume = () => {
    if (pausedAt === null) return
    const t = Date.now()
    setPausedTotalMs((total) => total + (t - pausedAt))
    setPausedAt(null)
    setNow(t)
  }

  const reset = () => {
    setStartedAt(null)
    setPausedAt(null)
    setPausedTotalMs(0)
  }

  return { state, status, start, pause, resume, reset }
}
