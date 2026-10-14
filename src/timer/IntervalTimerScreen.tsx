import { useEffect, useEffectEvent, useId, useRef, useState } from 'react'
import { formatSeconds, formatTime, getRound, getSet, type Workout } from './intervals.ts'
import { clearTimer } from './persistence.ts'
import { useCountdownCues } from './useCountdownCues.ts'
import { useIntervalTimer } from './useIntervalTimer.ts'
import { useWakeLock } from './useWakeLock.ts'
import './IntervalTimerScreen.css'

interface Props {
  workout: Workout
  // Start the workout as soon as the screen opens (after Start on the form).
  autoStart?: boolean
  // Leave for the settings form. When given, Android back is handled here.
  onExit?: () => void
}

const primaryLabel = {
  idle: 'Start',
  running: 'Pause',
  paused: 'Resume',
  finished: 'Restart',
} as const

// "SET 1/2" on screen; "Set 1 of 2" for screen readers, since TalkBack doesn't
// reliably read aria-label on a plain span.
function Chip({ label, value, total }: { label: string; value: number; total: number }) {
  return (
    <span className="timer__chip">
      <span aria-hidden="true">
        {label} {value}/{total}
      </span>
      <span className="visually-hidden">
        {label} {value} of {total}
      </span>
    </span>
  )
}

function IntervalTimerScreen({ workout, autoStart = false, onExit }: Props) {
  const cues = useCountdownCues()
  const { state, status, start, pause, resume, reset } = useIntervalTimer(workout, cues.onTime)
  useWakeLock(status === 'running')
  // null = no sheet. 'reset' is the top-bar Reset; 'exit' is Android back
  // during a workout. resumeOnCancel: whether Cancel should resume the countdown.
  const [resetDialog, setResetDialog] = useState<{
    kind: 'reset' | 'exit'
    resumeOnCancel: boolean
  } | null>(null)
  const confirmingReset = resetDialog !== null
  const dialogTitleId = useId()

  const startWithSound = () => {
    cues.prepare()
    start()
    const first = workout.intervals[0]
    if (first) cues.playIntervalStart(first.kind)
  }

  // Once per mount; the ref keeps StrictMode's double-mount from starting twice.
  const autoStarted = useRef(false)
  const startOnOpen = useEffectEvent(() => {
    if (autoStart && status === 'idle' && !autoStarted.current) {
      autoStarted.current = true
      startWithSound()
    }
  })
  useEffect(() => startOnOpen(), [])

  const resumeWithSound = () => {
    cues.prepare()
    resume()
  }

  const onPrimary = {
    idle: startWithSound,
    running: pause,
    paused: resumeWithSound,
    finished: startWithSound,
  }[status]

  const askReset = (kind: 'reset' | 'exit' = 'reset') => {
    const wasRunning = status === 'running'
    if (wasRunning) pause()
    setResetDialog({ kind, resumeOnCancel: wasRunning })
  }

  const confirmReset = () => {
    reset()
    setResetDialog(null)
    if (resetDialog?.kind === 'exit') {
      // The screen closes before reset() is saved, so forget the session here.
      clearTimer(workout)
      window.history.back() // drop the entry pushed on open
      onExit?.()
    }
  }

  const cancelReset = () => {
    if (resetDialog?.resumeOnCancel) resumeWithSound()
    setResetDialog(null)
  }

  // Android back: the timer adds one history entry while it's open, so back
  // pops it and fires popstate here instead of leaving the app.
  const pushBackGuard = () => window.history.pushState({ intervalTimer: true }, '')
  const onBack = useEffectEvent(() => {
    if (resetDialog) {
      cancelReset() // back while a sheet is open dismisses it
      pushBackGuard()
    } else if (status === 'running' || status === 'paused') {
      askReset('exit')
      pushBackGuard()
    } else {
      onExit?.()
    }
  })
  useEffect(() => {
    if (!onExit) return
    pushBackGuard()
    const handle = () => onBack()
    window.addEventListener('popstate', handle)
    return () => window.removeEventListener('popstate', handle)
  }, [onExit])

  const canReset = status === 'running' || status === 'paused'
  const isEmpty = workout.intervals.length === 0

  // Prepare and the rest between sets get their own screens, each with a
  // preview of what's next. Prepare also counts down in whole seconds.
  const isPrepare = state.interval?.kind === 'prepare'
  const isSetRest = state.interval?.kind === 'setRest'
  // Set and Work-round counters, shown on every screen but Done; see getSet/getRound.
  const round = getRound(workout, state.index)
  const set = getSet(workout, state.index)
  const next = isPrepare || isSetRest ? workout.intervals[state.index + 1] : undefined
  // As designed: "Next: Work · 0:20" on Prepare, "Next: Set 2 · Work 0:20" on a set break.
  const nextLabel =
    next &&
    (isSetRest && set
      ? `Next: Set ${set.set + 1} · ${next.name} ${formatTime(next.durationSec * 1000)}`
      : `Next: ${next.name} · ${formatTime(next.durationSec * 1000)}`)

  // Changes only when the interval changes, so screen readers aren't
  // interrupted every second.
  const announcement =
    status === 'idle'
      ? ''
      : state.interval
        ? `${state.interval.name}, ${state.interval.durationSec} seconds`
        : 'Workout complete'

  return (
    <>
      <main className="timer" data-kind={state.interval?.kind} inert={confirmingReset}>
        {/* Top: hardest to reach one-handed, so the destructive action lives here. */}
        <header className="timer__top">
          <span className="timer__chips">
            {set && <Chip label="Set" value={set.set} total={set.total} />}
            {round && <Chip label="Round" value={round.round} total={round.total} />}
          </span>
          {canReset && (
            <button type="button" className="timer__reset" onClick={() => askReset()}>
              Reset
            </button>
          )}
        </header>

        <section className="timer__display">
          {isSetRest && set && <p className="timer__complete">Set {set.set} complete</p>}
          {isEmpty ? (
            <p className="timer__message">This workout has no intervals.</p>
          ) : (
            <h1 className="timer__name">{state.interval ? state.interval.name : 'Done'}</h1>
          )}
          <p role="timer" className="timer__time">
            {isPrepare ? formatSeconds(state.remainingMs) : formatTime(state.remainingMs)}
          </p>
          {nextLabel && <p className="timer__next">{nextLabel}</p>}
          <p className="timer__paused">{status === 'paused' && 'Paused'}</p>
          <p role="status" className="visually-hidden">
            {announcement}
          </p>
        </section>

        {/* Bottom: the thumb zone, for the primary action. */}
        <footer className="timer__controls">
          <button type="button" className="timer__primary" onClick={onPrimary} disabled={isEmpty}>
            {primaryLabel[status]}
          </button>
        </footer>
      </main>

      {resetDialog && (
        <div className="scrim">
          <div
            className="sheet"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
          >
            <h2 id={dialogTitleId} className="sheet__title">
              {resetDialog.kind === 'exit' ? 'Reset workout and go back to settings?' : 'Reset workout?'}
            </h2>
            <p className="sheet__body">Your progress in this workout will be lost.</p>
            <button type="button" className="sheet__danger" onClick={confirmReset}>
              Reset
            </button>
            {/* Last = nearest the thumb, so the safe choice is the easiest one. */}
            <button type="button" className="sheet__cancel" onClick={cancelReset} autoFocus>
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default IntervalTimerScreen
