import type { Interval, Workout } from '../timer/intervals.ts'

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
