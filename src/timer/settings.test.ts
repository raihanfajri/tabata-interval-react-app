import { describe, expect, it, vi } from 'vitest'
import { getTimerState } from './intervals.ts'
import {
  buildWorkout,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  toForm,
  validateSettings,
} from './settings.ts'

describe('buildWorkout', () => {
  it('with the defaults has 32 intervals and lasts 8:18', () => {
    const workout = buildWorkout(DEFAULT_SETTINGS)

    expect(workout.intervals).toHaveLength(32)
    expect(getTimerState(workout, 497_999).finished).toBe(false)
    expect(getTimerState(workout, 498_000).finished).toBe(true)
  })

  it.each([
    ['the defaults', {}],
    ['1 set', { sets: 1 }],
  ])('ends on Work, with no Rest after the last Work: %s', (_label, settings) => {
    expect(buildWorkout({ ...DEFAULT_SETTINGS, ...settings }).intervals.at(-1)?.kind).toBe('work')
  })

  it('keeps the Rests between cycles: every Work but the last is followed by a Rest or the break', () => {
    const intervals = buildWorkout(DEFAULT_SETTINGS).intervals
    const afterWork = intervals.flatMap((i, n) => (i.kind === 'work' ? [intervals[n + 1]?.kind] : []))

    expect(afterWork.slice(0, -1).every((k) => k === 'rest' || k === 'setRest')).toBe(true)
    expect(afterWork.at(-1)).toBeUndefined()
  })

  it.each([
    ['Prepare 8', 8, ['prepare', 'work']],
    ['Prepare 0', 0, ['work']],
  ] as const)('with 1 set × 1 cycle builds only Prepare and Work: %s', (_label, prepareSec, expected) => {
    const intervals = buildWorkout({ ...DEFAULT_SETTINGS, sets: 1, cycles: 1, prepareSec }).intervals

    expect(intervals.map((i) => i.kind)).toEqual(expected)
  })

  it('the default workout is not named in the old format, so timers saved before the last Rest was removed are ignored', () => {
    expect(buildWorkout(DEFAULT_SETTINGS).name).not.toBe('Custom 8/20/10/30 · 2×8')
  })

  const kinds = (settings: Partial<typeof DEFAULT_SETTINGS>) =>
    buildWorkout({ ...DEFAULT_SETTINGS, ...settings }).intervals
  const durationsOf = (settings: Partial<typeof DEFAULT_SETTINGS>, kind: string) =>
    new Set(kinds(settings).filter((i) => i.kind === kind).map((i) => i.durationSec))

  it('uses each time: Work 30s, Rest 15s, Prepare 5s, Rest between sets 45s', () => {
    const settings = { workSec: 30, restSec: 15, prepareSec: 5, setRestSec: 45 }

    expect(durationsOf(settings, 'work')).toEqual(new Set([30]))
    expect(durationsOf(settings, 'rest')).toEqual(new Set([15]))
    expect(durationsOf(settings, 'prepare')).toEqual(new Set([5]))
    expect(durationsOf(settings, 'setRest')).toEqual(new Set([45]))
  })

  it('with 3 sets × 4 cycles builds 3 sets of 4 Work intervals with 2 breaks', () => {
    const intervals = kinds({ sets: 3, cycles: 4 })

    expect(intervals.filter((i) => i.kind === 'work')).toHaveLength(12)
    expect(intervals.filter((i) => i.kind === 'setRest')).toHaveLength(2)
    const breakAt = intervals.flatMap((i, n) => (i.kind === 'setRest' ? [n] : []))
    const worksBetween = intervals.slice(breakAt[0] + 1, breakAt[1]).filter((i) => i.kind === 'work')
    expect(worksBetween).toHaveLength(4)
  })

  it('with Prepare 0 has no Prepare interval', () => {
    const intervals = kinds({ prepareSec: 0 })

    expect(intervals.some((i) => i.kind === 'prepare')).toBe(false)
    expect(intervals[0].kind).toBe('work')
  })

  it('with Rest 0 has no Rest intervals (Work follows Work), and the breaks remain', () => {
    const intervals = kinds({ restSec: 0 })

    expect(intervals).toHaveLength(18)
    expect(intervals.some((i) => i.kind === 'rest')).toBe(false)
    expect(intervals.filter((i) => i.kind === 'work')).toHaveLength(16)
    expect(intervals.filter((i) => i.kind === 'setRest')).toHaveLength(1)
    expect(intervals.some((i) => i.durationSec === 0)).toBe(false)
  })

  it('with Rest between sets 0 has no break, set 1 keeps its last Rest, and set 2 ends on Work', () => {
    const intervals = kinds({ setRestSec: 0 })

    expect(intervals.some((i) => i.kind === 'setRest')).toBe(false)
    expect(intervals.filter((i) => i.kind === 'rest')).toHaveLength(15)
    // 0 Prepare; 1–16 set 1 (ends with Rest 8); 17–31 set 2.
    expect(intervals[16].kind).toBe('rest')
    expect(intervals[17].kind).toBe('work')
    expect(intervals.at(-1)?.kind).toBe('work')
  })

  it('with 1 set has no break', () => {
    expect(kinds({ sets: 1 }).some((i) => i.kind === 'setRest')).toBe(false)
  })

  it.each([
    ['prepareSec', 9],
    ['workSec', 21],
    ['restSec', 11],
    ['setRestSec', 31],
    ['sets', 3],
    ['cycles', 7],
  ] as const)('gives a different workout name when %s differs, and the same name for equal settings', (key, value) => {
    const base = buildWorkout(DEFAULT_SETTINGS).name

    expect(buildWorkout({ ...DEFAULT_SETTINGS, [key]: value }).name).not.toBe(base)
    expect(buildWorkout({ ...DEFAULT_SETTINGS }).name).toBe(base)
  })
})

describe('validateSettings', () => {
  const errorsFor = (key: keyof typeof DEFAULT_SETTINGS, value: string) =>
    validateSettings({ ...toForm(DEFAULT_SETTINGS), [key]: value })

  it('accepts the defaults with no errors', () => {
    expect(validateSettings(toForm(DEFAULT_SETTINGS))).toEqual({})
  })

  it.each([
    ['workSec', '1'],
    ['workSec', '600'],
    ['restSec', '0'],
    ['restSec', '600'],
    ['prepareSec', '0'],
    ['prepareSec', '60'],
    ['setRestSec', '0'],
    ['setRestSec', '600'],
    ['sets', '1'],
    ['sets', '10'],
    ['cycles', '1'],
    ['cycles', '30'],
  ] as const)('accepts %s at its limit %s', (key, value) => {
    expect(errorsFor(key, value)).toEqual({})
  })

  it.each([
    ['workSec', '0', 'Work must be between 1 and 600 seconds.'],
    ['workSec', '601', 'Work must be between 1 and 600 seconds.'],
    ['restSec', '-1', 'Rest must be between 0 and 600 seconds.'],
    ['restSec', '601', 'Rest must be between 0 and 600 seconds.'],
    ['prepareSec', '61', 'Prepare must be between 0 and 60 seconds.'],
    ['setRestSec', '601', 'Rest between sets must be between 0 and 600 seconds.'],
    ['sets', '0', 'Sets must be between 1 and 10.'],
    ['sets', '11', 'Sets must be between 1 and 10.'],
    ['cycles', '0', 'Cycles per set must be between 1 and 30.'],
    ['cycles', '31', 'Cycles per set must be between 1 and 30.'],
  ] as const)('rejects %s = %s just outside its limit', (key, value, message) => {
    expect(errorsFor(key, value)).toEqual({ [key]: message })
  })

  it.each(['', 'abc', '1.5', ' '])('rejects %j as not a whole number', (value) => {
    expect(errorsFor('workSec', value)).toEqual({ workSec: 'Enter a whole number of seconds.' })
    expect(errorsFor('sets', value)).toEqual({ sets: 'Enter a whole number.' })
  })
})

describe('loadSettings / saveSettings', () => {
  const custom = { ...DEFAULT_SETTINGS, workSec: 45, sets: 3 }

  it('returns the defaults when nothing is saved', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('returns the saved values after saveSettings', () => {
    saveSettings(custom)

    expect(loadSettings()).toEqual(custom)
  })

  it.each([
    ['not JSON', '{oops'],
    ['a missing field', JSON.stringify({ ...custom, cycles: undefined })],
    ['an out-of-range value', JSON.stringify({ ...custom, workSec: 0 })],
  ])('returns the defaults for corrupt data (%s)', (_label, raw) => {
    localStorage.setItem('interval-app:settings', raw)

    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('returns the defaults, and saving does not throw, when storage is unavailable', () => {
    const denied = () => {
      throw new DOMException('Storage is disabled', 'SecurityError')
    }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(denied)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(denied)

    expect(() => saveSettings(custom)).not.toThrow()
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })
})
