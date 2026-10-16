import { type Interval, type Workout, withPrepare, withSets } from './intervals.ts'

// The user's workout settings, from the "New Workout" form. Times are seconds.
export interface TimerSettings {
  prepareSec: number
  workSec: number
  restSec: number
  setRestSec: number
  sets: number
  cycles: number
}

export const DEFAULT_SETTINGS: TimerSettings = {
  prepareSec: 8,
  workSec: 20,
  restSec: 10,
  setRestSec: 30,
  sets: 2,
  cycles: 8,
}

// Builds the flat workout the timer runs: Prepare, then the sets of
// Work/Rest cycles with a rest between sets.
export function buildWorkout(settings: TimerSettings): Workout {
  const { prepareSec, workSec, restSec, setRestSec, sets, cycles } = settings
  // A 0s setting removes that screen: no 0s intervals are ever built.
  const cycle = Array.from({ length: cycles }, (_, c): Interval[] => [
    { id: `work-${c + 1}`, name: 'Work', durationSec: workSec, kind: 'work' },
    ...(restSec > 0
      ? [{ id: `rest-${c + 1}`, name: 'Rest', durationSec: restSec, kind: 'rest' } satisfies Interval]
      : []),
  ]).flat()
  // The name encodes every setting: saved timers are keyed by workout name, so
  // different settings must never share a key (see docs/docs.md, Persistence).
  // "v2": the workout no longer ends with a Rest, so timers saved by the old
  // shape must not reopen against this one.
  const name = `Custom ${prepareSec}/${workSec}/${restSec}/${setRestSec} · ${sets}×${cycles} · v2`
  const { intervals } = withSets({ name, intervals: cycle }, { sets, restBetweenSec: setRestSec })
  // Nothing follows the last Work, so a Rest after it would only delay Done.
  const endsWithRest = intervals.at(-1)?.kind === 'rest'
  const workout = { name, intervals: endsWithRest ? intervals.slice(0, -1) : intervals }
  return prepareSec > 0 ? withPrepare(workout, prepareSec) : workout
}

export type SettingKey = keyof TimerSettings

// The form holds text while the user types; it's validated before use.
export type SettingsForm = Record<SettingKey, string>

interface FieldSpec {
  label: string
  min: number
  max: number
  step: number
  seconds: boolean
}

// Order is the form's field order. 0 removes that screen (see buildWorkout).
export const FIELDS: Record<SettingKey, FieldSpec> = {
  prepareSec: { label: 'Prepare', min: 0, max: 60, step: 5, seconds: true },
  workSec: { label: 'Work', min: 1, max: 600, step: 5, seconds: true },
  restSec: { label: 'Rest', min: 0, max: 600, step: 5, seconds: true },
  setRestSec: { label: 'Rest between sets', min: 0, max: 600, step: 5, seconds: true },
  sets: { label: 'Sets', min: 1, max: 10, step: 1, seconds: false },
  cycles: { label: 'Cycles per set', min: 1, max: 30, step: 1, seconds: false },
}

export const SETTING_KEYS = Object.keys(FIELDS) as SettingKey[]

export const toForm = (settings: TimerSettings): SettingsForm =>
  Object.fromEntries(SETTING_KEYS.map((k) => [k, String(settings[k])])) as SettingsForm

// A whole number, or null for empty, non-numeric or fractional text.
const parseWhole = (text: string) => (/^-?\d+$/.test(text.trim()) ? Number(text) : null)

// One message per invalid field; an empty object means the form is valid.
export function validateSettings(form: SettingsForm): Partial<Record<SettingKey, string>> {
  const errors: Partial<Record<SettingKey, string>> = {}
  for (const key of SETTING_KEYS) {
    const { label, min, max, seconds } = FIELDS[key]
    const value = parseWhole(form[key])
    if (value === null) {
      errors[key] = seconds ? 'Enter a whole number of seconds.' : 'Enter a whole number.'
    } else if (value < min || value > max) {
      errors[key] = `${label} must be between ${min} and ${max}${seconds ? ' seconds' : ''}.`
    }
  }
  return errors
}

// Settings are remembered between launches. Like the saved timer, every
// failure (corrupt data, blocked storage) quietly falls back to the defaults.
const SETTINGS_KEY = 'interval-app:settings'

export function loadSettings(): TimerSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw === null) return DEFAULT_SETTINGS
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_SETTINGS
    const values = parsed as Record<string, unknown>
    if (!SETTING_KEYS.every((k) => typeof values[k] === 'number')) return DEFAULT_SETTINGS
    const settings = values as unknown as TimerSettings
    const valid = Object.keys(validateSettings(toForm(settings))).length === 0
    return valid ? settings : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: TimerSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Storage unavailable: the settings just aren't remembered.
  }
}
