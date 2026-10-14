import { afterEach, describe, expect, it, vi } from 'vitest'
import { getMockWorkout } from '../test/factories.ts'
import { TABATA, withPrepare } from './intervals.ts'
import { buildWorkout, DEFAULT_SETTINGS } from './settings.ts'
import { clearTimer, loadTimer, saveTimer, type SavedTimer } from './persistence.ts'

const getMockSaved = (overrides?: Partial<SavedTimer>): SavedTimer => ({
  startedAt: 1_000_000,
  pausedAt: null,
  pausedTotalMs: 0,
  ...overrides,
})

afterEach(() => {
  localStorage.clear()
})

describe('loadTimer', () => {
  it('returns nothing when nothing is saved', () => {
    expect(loadTimer(getMockWorkout())).toBeNull()
  })

  it('returns what saveTimer saved for the same workout', () => {
    const saved = getMockSaved({ pausedAt: 1_005_000, pausedTotalMs: 2_000 })

    saveTimer(getMockWorkout(), saved)

    expect(loadTimer(getMockWorkout())).toEqual(saved)
  })

  it('ignores state saved for a different workout', () => {
    saveTimer(getMockWorkout({ name: 'Tabata' }), getMockSaved())

    expect(loadTimer(getMockWorkout({ name: 'HIIT' }))).toBeNull()
  })

  it.each([
    ['not JSON', '{oops'],
    ['null', 'null'],
    ['missing startedAt', '{"pausedAt":null,"pausedTotalMs":0}'],
    ['wrong types', '{"startedAt":"yesterday","pausedAt":null,"pausedTotalMs":0}'],
  ])('ignores corrupt or wrong-shaped saved data (%s)', (_label, raw) => {
    localStorage.setItem('interval-app:timer:Test workout', raw)

    expect(loadTimer(getMockWorkout())).toBeNull()
  })
})

describe('when storage is unavailable', () => {
  it("loadTimer, saveTimer and clearTimer don't throw", () => {
    const denied = () => {
      throw new DOMException('Storage is disabled', 'SecurityError')
    }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(denied)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(denied)
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(denied)
    const workout = getMockWorkout()

    expect(() => saveTimer(workout, getMockSaved())).not.toThrow()
    expect(loadTimer(workout)).toBeNull()
    expect(() => clearTimer(workout)).not.toThrow()
  })
})

describe('workout shape changes', () => {
  it('a timer saved for the old 1-set "Tabata" workout is ignored by the default workout', () => {
    saveTimer(withPrepare(TABATA), getMockSaved())

    expect(loadTimer(buildWorkout(DEFAULT_SETTINGS))).toBeNull()
  })

  it('a timer saved under one set of settings is ignored by a workout built from different settings', () => {
    saveTimer(buildWorkout(DEFAULT_SETTINGS), getMockSaved())

    expect(loadTimer(buildWorkout({ ...DEFAULT_SETTINGS, workSec: 30 }))).toBeNull()
    expect(loadTimer(buildWorkout(DEFAULT_SETTINGS))).toEqual(getMockSaved())
  })
})
