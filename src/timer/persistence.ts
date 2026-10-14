import type { Workout } from './intervals.ts'

// Saves the running timer's timestamps so a workout survives the app being
// closed. Every function tolerates unavailable storage (private mode, blocked
// site data): the timer then just doesn't survive a close.

export interface SavedTimer {
  startedAt: number
  pausedAt: number | null
  pausedTotalMs: number
}

// One saved timer per workout, keyed by name.
const keyFor = (workout: Workout) => `interval-app:timer:${workout.name}`

const isSavedTimer = (value: unknown): value is SavedTimer => {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.startedAt === 'number' &&
    (v.pausedAt === null || typeof v.pausedAt === 'number') &&
    typeof v.pausedTotalMs === 'number'
  )
}

export function loadTimer(workout: Workout): SavedTimer | null {
  try {
    const raw = localStorage.getItem(keyFor(workout))
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    return isSavedTimer(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function saveTimer(workout: Workout, saved: SavedTimer) {
  try {
    localStorage.setItem(keyFor(workout), JSON.stringify(saved))
  } catch {
    // Storage unavailable or full.
  }
}

export function clearTimer(workout: Workout) {
  try {
    localStorage.removeItem(keyFor(workout))
  } catch {
    // Storage unavailable.
  }
}
