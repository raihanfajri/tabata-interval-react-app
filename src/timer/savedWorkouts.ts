import { formatTime } from './intervals.ts'
import { parseSettings, totalMs, type TimerSettings } from './settings.ts'

// Workouts the user named and saved from the form, newest first. The name is
// only a label: the timer still keys its saved session by buildWorkout's name.
export interface SavedWorkout {
  name: string
  settings: TimerSettings
}

export const NAME_MAX_LENGTH = 40

// Names match ignoring case and surrounding spaces, so "Tabata " replaces "tabata".
export const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export const findSavedWorkout = (list: SavedWorkout[], name: string) =>
  list.find((w) => sameName(w.name, name))

// Saving under an existing name replaces that workout and moves it to the top.
export const addSavedWorkout = (list: SavedWorkout[], name: string, settings: TimerSettings) => [
  { name: name.trim(), settings },
  ...list.filter((w) => !sameName(w.name, name)),
]

export const removeSavedWorkout = (list: SavedWorkout[], name: string) =>
  list.filter((w) => !sameName(w.name, name))

// "Work 0:20 · Rest 0:10 · 2 × 8 · 8:18"
export const describeSettings = (settings: TimerSettings) =>
  [
    `Work ${formatTime(settings.workSec * 1000)}`,
    `Rest ${formatTime(settings.restSec * 1000)}`,
    `${settings.sets} × ${settings.cycles}`,
    formatTime(totalMs(settings)),
  ].join(' · ')

// Like the settings, every failure (corrupt data, blocked storage) quietly
// falls back: a corrupt entry is dropped, unreadable storage gives no workouts.
const WORKOUTS_KEY = 'interval-app:workouts'

const parseSavedWorkout = (value: unknown): SavedWorkout | null => {
  if (typeof value !== 'object' || value === null) return null
  const { name, settings } = value as Record<string, unknown>
  if (typeof name !== 'string' || name.trim() === '') return null
  const parsed = parseSettings(settings)
  return parsed && { name: name.trim().slice(0, NAME_MAX_LENGTH), settings: parsed }
}

export function loadSavedWorkouts(): SavedWorkout[] {
  try {
    const raw = localStorage.getItem(WORKOUTS_KEY)
    if (raw === null) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(parseSavedWorkout).filter((w): w is SavedWorkout => w !== null)
  } catch {
    return []
  }
}

export function storeSavedWorkouts(list: SavedWorkout[]) {
  try {
    localStorage.setItem(WORKOUTS_KEY, JSON.stringify(list))
  } catch {
    // Storage unavailable: the list lasts until the app is closed.
  }
}
