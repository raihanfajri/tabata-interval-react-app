import { useRef } from 'react'
import type { IntervalKind, TimerState } from './intervals.ts'
import { playBeep, playBell, playWhistle } from './sounds.ts'

const CUE_SECONDS = [3, 2, 1]

// Beeps and vibrates when the displayed time reaches 0:03, 0:02 and 0:01, and
// plays a whistle (Work) or boxing bell (Rest, and the end of the workout) when
// the timer ticks into the next interval.
// Pass `onTime` to useIntervalTimer. A cue fires only when the displayed
// second is exactly one below the previous reading in the same interval, so
// catching up after the app was hidden, or resuming, never replays a cue.
export function useCountdownCues() {
  const audioRef = useRef<AudioContext | null>(null)
  const lastRef = useRef<{ index: number; secondsLeft: number } | null>(null)

  const onTime = (state: TimerState) => {
    const secondsLeft = Math.ceil(state.remainingMs / 1000)
    const last = lastRef.current
    lastRef.current = { index: state.index, secondsLeft }

    // Ticked from 0:01 of one interval straight into the next.
    const crossed = last !== null && last.secondsLeft === 1 && last.index + 1 === state.index
    if (crossed) {
      // The end of the workout gets the bell too, like the end of a round.
      playIntervalStart(state.interval?.kind ?? 'rest')
      return
    }

    const ticked =
      last !== null && last.index === state.index && last.secondsLeft - 1 === secondsLeft
    if (!ticked || !CUE_SECONDS.includes(secondsLeft)) return

    if (audioRef.current) playBeep(audioRef.current)
    if ('vibrate' in navigator) navigator.vibrate(100)
  }

  // Call from the Start/Resume tap: Android only allows audio after a gesture.
  const prepare = () => {
    if (!('AudioContext' in window)) return
    audioRef.current ??= new AudioContext()
    if (audioRef.current.state === 'suspended') void audioRef.current.resume()
  }

  // Sound for entering an interval: whistle for Work, boxing bell for Rest and
  // the rest between sets, nothing for Prepare (it begins silently; the whistle
  // means "go").
  function playIntervalStart(kind: IntervalKind) {
    if (!audioRef.current) return
    if (kind === 'work') playWhistle(audioRef.current)
    else if (kind === 'rest' || kind === 'setRest') playBell(audioRef.current)
  }

  return { onTime, prepare, playIntervalStart }
}
