import { useState, type FormEvent } from 'react'
import { formatTime } from './intervals.ts'
import { NAME_MAX_LENGTH } from './savedWorkouts.ts'
import {
  FIELDS,
  SETTING_KEYS,
  toForm,
  totalMs,
  validateSettings,
  type SettingKey,
  type SettingsForm,
  type TimerSettings,
} from './settings.ts'
import './SettingsScreen.css'

interface Props {
  initial: TimerSettings
  // The workout's name, if it has one (it was chosen from or saved to the list).
  initialName?: string
  onStart: (settings: TimerSettings, name: string) => void
  // Save these settings under this name (trimmed, never blank).
  onSave: (name: string, settings: TimerSettings) => void
  // The top-bar back arrow: back to the saved workouts.
  onBack: () => void
}

const toSettings = (form: SettingsForm): TimerSettings =>
  Object.fromEntries(SETTING_KEYS.map((k) => [k, Number(form[k])])) as unknown as TimerSettings

// The "New Workout" form: how long each screen lasts, and how many sets and
// cycles. Start is the big bottom button, in thumb reach. A name is only
// needed to save the workout to the list.
function SettingsScreen({ initial, initialName = '', onStart, onSave, onBack }: Props) {
  const [form, setForm] = useState(() => toForm(initial))
  const [name, setName] = useState(initialName)
  const [nameError, setNameError] = useState(false)
  // The "Saved “Tabata”" confirmation, cleared by the next edit.
  const [savedAs, setSavedAs] = useState<string | null>(null)
  const errors = validateSettings(form)
  const valid = Object.keys(errors).length === 0

  const total = valid ? totalMs(toSettings(form)) : null

  const setField = (key: SettingKey, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    setSavedAs(null)
  }

  const changeName = (value: string) => {
    setName(value)
    setNameError(false)
    setSavedAs(null)
  }

  const save = () => {
    const trimmed = name.trim()
    if (trimmed === '') {
      setNameError(true)
      return
    }
    onSave(trimmed, toSettings(form))
    setName(trimmed)
    setSavedAs(trimmed)
  }

  // − / + move by the field's step and stop at its limits. From an invalid
  // value they start over from the minimum.
  const stepField = (key: SettingKey, direction: 1 | -1) => {
    const { min, max, step } = FIELDS[key]
    const current = Number(form[key])
    const base = Number.isInteger(current) ? current : min
    setField(key, String(Math.min(max, Math.max(min, base + direction * step))))
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (valid) onStart(toSettings(form), name.trim())
  }

  return (
    <main className="settings">
      {/* Material 3 small top app bar: up arrow, then the title. */}
      <header className="settings__bar">
        <button type="button" className="settings__back" aria-label="Back" onClick={onBack}>
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
        </button>
        <h1 className="settings__title">New Workout</h1>
      </header>
      <form className="settings__form" onSubmit={submit} noValidate>
        <div className="field">
          <label className="field__label" htmlFor="setting-name">
            Name
          </label>
          <div className="field__name">
            <input
              id="setting-name"
              className="field__input field__input--text"
              value={name}
              maxLength={NAME_MAX_LENGTH}
              autoComplete="off"
              enterKeyHint="done"
              placeholder="e.g. Tabata"
              onChange={(e) => changeName(e.target.value)}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? 'setting-name-error' : undefined}
            />
            {/* Saving needs valid settings, like Start. */}
            <button type="button" className="field__save" onClick={save} disabled={!valid}>
              Save
            </button>
          </div>
          {nameError && (
            <p id="setting-name-error" className="field__error" role="alert">
              Enter a name to save this workout.
            </p>
          )}
          <p className="field__saved" role="status">
            {savedAs && `Saved “${savedAs}”`}
          </p>
        </div>
        {SETTING_KEYS.map((key) => {
          const { label, seconds } = FIELDS[key]
          const id = `setting-${key}`
          const error = errors[key]
          return (
            <div className="field" key={key}>
              <label className="field__label" htmlFor={id}>
                {label}
                {seconds && ' (seconds)'}
              </label>
              <div className="field__stepper">
                <button
                  type="button"
                  className="field__step"
                  aria-label={`Decrease ${label}`}
                  onClick={() => stepField(key, -1)}
                >
                  −
                </button>
                <input
                  id={id}
                  className="field__input"
                  inputMode="numeric"
                  value={form[key]}
                  onChange={(e) => setField(key, e.target.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? `${id}-error` : undefined}
                />
                <button
                  type="button"
                  className="field__step"
                  aria-label={`Increase ${label}`}
                  onClick={() => stepField(key, 1)}
                >
                  +
                </button>
              </div>
              {error && (
                <p id={`${id}-error`} className="field__error" role="alert">
                  {error}
                </p>
              )}
            </div>
          )
        })}
        <p className="settings__total">Total {total === null ? '–' : formatTime(total)}</p>
        <button type="submit" className="settings__start" disabled={!valid}>
          Start
        </button>
      </form>
    </main>
  )
}

export default SettingsScreen
