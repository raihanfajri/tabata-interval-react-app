import { describe, expect, it } from 'vitest'
import { getMockWorkout } from '../test/factories.ts'
import {
  formatSeconds,
  formatTime,
  getRound,
  getSet,
  getTimerState,
  TABATA,
  withPrepare,
  withSets,
} from './intervals.ts'
import { buildWorkout, DEFAULT_SETTINGS } from './settings.ts'

describe('getTimerState', () => {
  it('returns the first interval with its full duration at 0ms elapsed', () => {
    const workout = getMockWorkout()

    const state = getTimerState(workout, 0)

    expect(state.index).toBe(0)
    expect(state.interval).toBe(workout.intervals[0])
    expect(state.remainingMs).toBe(20_000)
    expect(state.finished).toBe(false)
  })

  it("returns the second interval when elapsed equals the first interval's duration exactly", () => {
    const workout = getMockWorkout()

    const state = getTimerState(workout, 20_000)

    expect(state.index).toBe(1)
    expect(state.interval).toBe(workout.intervals[1])
    expect(state.remainingMs).toBe(10_000)
    expect(state.finished).toBe(false)
  })

  it.each([30_000, 45_000])(
    'reports finished once elapsed reaches the total workout duration, and stays finished beyond it (%ims)',
    (elapsedMs) => {
      const state = getTimerState(getMockWorkout(), elapsedMs)

      expect(state.finished).toBe(true)
      expect(state.interval).toBeNull()
      expect(state.remainingMs).toBe(0)
    },
  )

  it('handles a workout with no intervals as finished/empty without throwing', () => {
    const state = getTimerState(getMockWorkout({ intervals: [] }), 0)

    expect(state.finished).toBe(true)
    expect(state.interval).toBeNull()
    expect(state.remainingMs).toBe(0)
  })
})

describe('formatTime', () => {
  it.each([
    [5_000, '0:05'],
    [90_000, '1:30'],
    [600_000, '10:00'],
  ])('formats %ims as %s (m:ss)', (ms, expected) => {
    expect(formatTime(ms)).toBe(expected)
  })

  it.each([
    [29_001, '0:30'],
    [29_000, '0:29'],
    [1, '0:01'],
  ])('rounds remaining time up to the second: %ims left shows %s', (ms, expected) => {
    expect(formatTime(ms)).toBe(expected)
  })
})

describe('withPrepare', () => {
  it('puts an 8s Prepare interval (kind prepare) before the first interval, and leaves the rest unchanged', () => {
    const workout = getMockWorkout()

    const prepared = withPrepare(workout)

    expect(prepared.intervals[0]).toMatchObject({ name: 'Prepare', durationSec: 8, kind: 'prepare' })
    expect(prepared.intervals.slice(1)).toEqual(workout.intervals)
    expect(prepared.name).toBe(workout.name)
  })

  it('leaves an empty workout empty', () => {
    expect(withPrepare(getMockWorkout({ intervals: [] })).intervals).toEqual([])
  })

  it('with Prepare added, getTimerState returns Prepare at 0ms and the first Work interval at exactly 8,000ms', () => {
    const prepared = withPrepare(getMockWorkout())

    expect(getTimerState(prepared, 0)).toMatchObject({ index: 0, remainingMs: 8_000 })
    expect(getTimerState(prepared, 0).interval?.kind).toBe('prepare')
    expect(getTimerState(prepared, 8_000)).toMatchObject({ index: 1, remainingMs: 20_000 })
    expect(getTimerState(prepared, 8_000).interval?.kind).toBe('work')
  })

  it('the Tabata workout with Prepare totals 4:08 (finished at 248,000ms, not before)', () => {
    const prepared = withPrepare(TABATA)

    expect(getTimerState(prepared, 247_999).finished).toBe(false)
    expect(getTimerState(prepared, 248_000).finished).toBe(true)
  })
})

describe('formatSeconds', () => {
  it.each([
    [8_000, '8'],
    [7_001, '8'],
    [7_000, '7'],
    [1, '1'],
  ])('shows %ims as %s (whole seconds, rounded up)', (ms, expected) => {
    expect(formatSeconds(ms)).toBe(expected)
  })
})

describe('getRound', () => {
  // withPrepare(TABATA): Prepare, then Work/Rest × 8 → indexes 1, 3 … 15 are Work.
  const prepared = withPrepare(TABATA)

  it.each([
    [1, { round: 1, total: 8 }],
    [3, { round: 2, total: 8 }],
    [15, { round: 8, total: 8 }],
  ])('returns round n of the Work-interval total for the Work interval at index %i', (index, expected) => {
    expect(getRound(prepared, index)).toEqual(expected)
  })

  it.each([
    ['Prepare (the upcoming round)', 0, { round: 1, total: 8 }],
    ['Rest after Work 1', 2, { round: 1, total: 8 }],
    ['Rest after Work 3', 6, { round: 3, total: 8 }],
  ])('returns a round for %s', (_label, index, expected) => {
    expect(getRound(prepared, index)).toEqual(expected)
  })

  it('returns nothing past the end (Done) or for an empty workout', () => {
    expect(getRound(prepared, 17)).toBeNull()
    expect(getRound(withPrepare(getMockWorkout({ intervals: [] })), 0)).toBeNull()
  })
})

describe('withSets', () => {
  it("repeats the workout per set and replaces each set's last interval, except the final set's, with a 30s break", () => {
    // getMockWorkout(): Work 20s, Rest 10s.
    const sets = withSets(getMockWorkout(), { sets: 2, restBetweenSec: 30 })

    expect(sets.intervals.map((i) => [i.kind, i.durationSec])).toEqual([
      ['work', 20],
      ['setRest', 30],
      ['work', 20],
      ['rest', 10],
    ])
    expect(sets.intervals[1].name).toBe('Rest between sets')
    expect(new Set(sets.intervals.map((i) => i.id)).size).toBe(4) // ids stay unique
  })
})

// The default workout (Prepare, 2 sets × 8 cycles, 30s break) as a fixture;
// its shape and length are tested in settings.test.ts.
const DEFAULT_WORKOUT = buildWorkout(DEFAULT_SETTINGS)

describe('sets in the default workout', () => {
  // Indexes: 0 Prepare; 1–15 set 1 (Work on odd); 16 the break; 17–32 set 2 (Work on odd).
  it.each([
    ['Prepare', 0, { round: 1, total: 8 }],
    ["set 1's last Work", 15, { round: 8, total: 8 }],
    ['the break', 16, { round: 8, total: 8 }],
    ["set 2's first Work", 17, { round: 1, total: 8 }],
    ["set 2's last Rest", 32, { round: 8, total: 8 }],
  ])('getRound restarts per set: %s', (_label, index, expected) => {
    expect(getRound(DEFAULT_WORKOUT, index)).toEqual(expected)
  })

  it('getRound returns nothing for Done in the default workout', () => {
    expect(getRound(DEFAULT_WORKOUT, 33)).toBeNull()
  })

  it.each([
    ['Prepare', 0, { set: 1, total: 2 }],
    ["set 1's last Work", 15, { set: 1, total: 2 }],
    ['the break', 16, { set: 1, total: 2 }],
    ["set 2's first Work", 17, { set: 2, total: 2 }],
    ["set 2's last Rest", 32, { set: 2, total: 2 }],
  ])('getSet: %s', (_label, index, expected) => {
    expect(getSet(DEFAULT_WORKOUT, index)).toEqual(expected)
  })

  it('getSet returns nothing for Done, and 1 of 1 for a workout without sets', () => {
    expect(getSet(DEFAULT_WORKOUT, 33)).toBeNull()
    expect(getSet(getMockWorkout(), 0)).toEqual({ set: 1, total: 1 })
  })
})
