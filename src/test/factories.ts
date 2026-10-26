import type { Interval, Workout } from '../timer/intervals.ts'
import type { WorkoutSession } from '../timer/history.ts'
import type { SavedWorkout } from '../timer/savedWorkouts.ts'
import { DEFAULT_SETTINGS } from '../timer/settings.ts'

export const getMockInterval = (overrides?: Partial<Interval>): Interval => ({
  id: 'interval-1',
  name: 'Work',
  durationSec: 20,
  kind: 'work',
  ...overrides,
})

// Two intervals: Work 20s, then Rest 10s.
export const getMockWorkout = (overrides?: Partial<Workout>): Workout => ({
  name: 'Test workout',
  intervals: [
    getMockInterval({ id: 'work-1' }),
    getMockInterval({ id: 'rest-1', name: 'Rest', durationSec: 10, kind: 'rest' }),
  ],
  ...overrides,
})

export const getMockSavedWorkout = (overrides?: Partial<SavedWorkout>): SavedWorkout => ({
  name: 'Tabata',
  settings: DEFAULT_SETTINGS,
  ...overrides,
})

export const getMockSession = (overrides?: Partial<WorkoutSession>): WorkoutSession => ({
  startedAt: new Date(2026, 9, 26, 7, 30).getTime(),
  activeMs: 498_000,
  ...overrides,
})
