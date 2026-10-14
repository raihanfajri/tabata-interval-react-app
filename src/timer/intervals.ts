export type IntervalKind = 'prepare' | 'work' | 'rest' | 'setRest'

export interface Interval {
  id: string
  name: string
  durationSec: number
  kind: IntervalKind
}

export interface Workout {
  name: string
  intervals: Interval[]
}

export interface TimerState {
  index: number
  interval: Interval | null
  remainingMs: number
  finished: boolean
}

export function getTimerState(workout: Workout, elapsedMs: number): TimerState {
  let intervalEndMs = 0
  for (const [index, interval] of workout.intervals.entries()) {
    intervalEndMs += interval.durationSec * 1000
    if (elapsedMs < intervalEndMs) {
      return { index, interval, remainingMs: intervalEndMs - elapsedMs, finished: false }
    }
  }
  return { index: workout.intervals.length, interval: null, remainingMs: 0, finished: true }
}

// Rounds up, so a countdown shows 0:01 until it actually reaches zero.
export function formatTime(ms: number): string {
  const totalSec = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSec / 60)
  const seconds = totalSec % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

// The intervals [start, end) of the set the interval at `index` belongs to.
// Sets are separated by `setRest` intervals; a break belongs to the set it ends.
function setBounds(workout: Workout, index: number) {
  const { intervals } = workout
  let start = 0
  for (let j = 0; j < index; j++) if (intervals[j].kind === 'setRest') start = j + 1
  let end = intervals.length
  for (let j = index; j < intervals.length; j++) {
    if (intervals[j].kind === 'setRest') {
      end = j
      break
    }
  }
  return { start, end }
}

// The Work round shown for the interval at `index` ("2 of 8"), counted within
// its set: a Work interval's own round, the round a Rest or set break follows,
// or round 1 for a Prepare before any Work. Null past the end (Done) or when
// the set has no Work intervals.
export function getRound(workout: Workout, index: number): { round: number; total: number } | null {
  if (index >= workout.intervals.length) return null
  const { start, end } = setBounds(workout, index)
  const isWork = (i: Interval) => i.kind === 'work'
  const total = workout.intervals.slice(start, end).filter(isWork).length
  if (total === 0) return null
  const workSoFar = workout.intervals.slice(start, index + 1).filter(isWork).length
  return { round: Math.max(1, workSoFar), total }
}

// The set the interval at `index` belongs to ("1 of 2"); a break belongs to
// the set it ends. Null past the end (Done) or for an empty workout.
export function getSet(workout: Workout, index: number): { set: number; total: number } | null {
  const { intervals } = workout
  if (index >= intervals.length) return null
  const isBreak = (i: Interval) => i.kind === 'setRest'
  return {
    set: intervals.slice(0, index).filter(isBreak).length + 1,
    total: intervals.filter(isBreak).length + 1,
  }
}

// Whole seconds only, rounded up like formatTime; used by the Prepare screen.
export function formatSeconds(ms: number): string {
  return String(Math.ceil(ms / 1000))
}

// Default workout until workouts can be edited: 8 rounds of 20s work / 10s rest.
export const TABATA: Workout = {
  name: 'Tabata',
  intervals: Array.from({ length: 8 }, (_, round): Interval[] => [
    { id: `work-${round + 1}`, name: 'Work', durationSec: 20, kind: 'work' },
    { id: `rest-${round + 1}`, name: 'Rest', durationSec: 10, kind: 'rest' },
  ]).flat(),
}

export const PREPARE: Interval = { id: 'prepare', name: 'Prepare', durationSec: 8, kind: 'prepare' }

// Adds the Prepare countdown (8s by default) before the workout's first
// interval. An empty workout stays empty, so it can't be "started" just to
// run Prepare.
export function withPrepare(workout: Workout, durationSec = PREPARE.durationSec): Workout {
  if (workout.intervals.length === 0) return workout
  return { ...workout, intervals: [{ ...PREPARE, durationSec }, ...workout.intervals] }
}

// Repeats the workout's intervals `sets` times with a "Rest between sets"
// after every set but the last. The break replaces the set's final Rest if it
// ends with one (a short Rest straight into a longer one is redundant);
// otherwise it's added after the set. A 0s break means no break at all.
export function withSets(
  workout: Workout,
  { sets, restBetweenSec }: { sets: number; restBetweenSec: number },
): Workout {
  const intervals = Array.from({ length: sets }, (_, s): Interval[] => {
    const set = workout.intervals.map((i) => ({ ...i, id: `s${s + 1}-${i.id}` }))
    if (s === sets - 1 || restBetweenSec <= 0) return set
    const setRest: Interval = {
      id: `set-rest-${s + 1}`,
      name: 'Rest between sets',
      durationSec: restBetweenSec,
      kind: 'setRest',
    }
    const endsWithRest = set.at(-1)?.kind === 'rest'
    return [...(endsWithRest ? set.slice(0, -1) : set), setRest]
  }).flat()
  return { ...workout, intervals }
}
