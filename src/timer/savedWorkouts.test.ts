import { describe, expect, it, vi } from 'vitest'
import { getMockSavedWorkout } from '../test/factories.ts'
import {
  addSavedWorkout,
  describeSettings,
  findSavedWorkout,
  loadSavedWorkouts,
  removeSavedWorkout,
  storeSavedWorkouts,
} from './savedWorkouts.ts'
import { DEFAULT_SETTINGS } from './settings.ts'

const long = { ...DEFAULT_SETTINGS, workSec: 45 }

describe('addSavedWorkout', () => {
  it('puts a new workout first, with its name trimmed', () => {
    const list = [getMockSavedWorkout({ name: 'Easy' })]

    expect(addSavedWorkout(list, '  Hard  ', long)).toEqual([
      { name: 'Hard', settings: long },
      getMockSavedWorkout({ name: 'Easy' }),
    ])
  })

  it('replaces a workout with the same name, ignoring case, and moves it first', () => {
    const list = [getMockSavedWorkout({ name: 'Easy' }), getMockSavedWorkout({ name: 'Tabata' })]

    expect(addSavedWorkout(list, 'TABATA', long)).toEqual([
      { name: 'TABATA', settings: long },
      getMockSavedWorkout({ name: 'Easy' }),
    ])
  })
})

describe('findSavedWorkout / removeSavedWorkout', () => {
  const list = [getMockSavedWorkout({ name: 'Easy' }), getMockSavedWorkout({ name: 'Tabata' })]

  it('find a workout by name, ignoring case and spaces', () => {
    expect(findSavedWorkout(list, ' tabata ')).toBe(list[1])
    expect(findSavedWorkout(list, 'Other')).toBeUndefined()
  })

  it('remove only the named workout', () => {
    expect(removeSavedWorkout(list, 'easy')).toEqual([list[1]])
  })
})

describe('describeSettings', () => {
  it('summarises the defaults as "Work 0:20 · Rest 0:10 · 2 × 8 · 8:18"', () => {
    expect(describeSettings(DEFAULT_SETTINGS)).toBe('Work 0:20 · Rest 0:10 · 2 × 8 · 8:18')
  })
})

describe('loadSavedWorkouts / storeSavedWorkouts', () => {
  it('returns no workouts when nothing is saved', () => {
    expect(loadSavedWorkouts()).toEqual([])
  })

  it('returns the stored list in order', () => {
    const list = [getMockSavedWorkout({ name: 'Hard', settings: long }), getMockSavedWorkout()]
    storeSavedWorkouts(list)

    expect(loadSavedWorkouts()).toEqual(list)
  })

  it.each([
    ['not JSON', '{oops'],
    ['not a list', JSON.stringify({ name: 'Tabata' })],
  ])('returns no workouts for corrupt data (%s)', (_label, raw) => {
    localStorage.setItem('interval-app:workouts', raw)

    expect(loadSavedWorkouts()).toEqual([])
  })

  it('drops only the corrupt entries: no name, a blank name, or invalid settings', () => {
    localStorage.setItem(
      'interval-app:workouts',
      JSON.stringify([
        { settings: DEFAULT_SETTINGS },
        { name: '  ', settings: DEFAULT_SETTINGS },
        { name: 'Broken', settings: { ...DEFAULT_SETTINGS, workSec: 0 } },
        getMockSavedWorkout(),
      ]),
    )

    expect(loadSavedWorkouts()).toEqual([getMockSavedWorkout()])
  })

  it('returns no workouts, and storing does not throw, when storage is unavailable', () => {
    const denied = () => {
      throw new DOMException('Storage is disabled', 'SecurityError')
    }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(denied)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(denied)

    expect(() => storeSavedWorkouts([getMockSavedWorkout()])).not.toThrow()
    expect(loadSavedWorkouts()).toEqual([])
  })
})
