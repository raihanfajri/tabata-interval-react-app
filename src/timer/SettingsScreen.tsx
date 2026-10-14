import { useState, type FormEvent } from 'react'
import { formatTime } from './intervals.ts'
import {
  buildWorkout,
  FIELDS,
  SETTING_KEYS,
  toForm,
  validateSettings,
  type SettingKey,
  type SettingsForm,
  type TimerSettings,
} from './settings.ts'
import './SettingsScreen.css'

interface Props {
  initial: TimerSettings
  onStart: (settings: TimerSettings) => void
}

const toSettings = (form: SettingsForm): TimerSettings =>
  Object.fromEntries(SETTING_KEYS.map((k) => [k, Number(form[k])])) as unknown as TimerSettings

// The "New Workout" form: how long each screen lasts, and how many sets and
// cycles. Start is the big bottom button, in thumb reach.
function SettingsScreen({ initial, onStart }: Props) {
  const [form, setForm] = useState(() => toForm(initial))
  const errors = validateSettings(form)
  const valid = Object.keys(errors).length === 0

  const totalMs = valid
    ? buildWorkout(toSettings(form)).intervals.reduce((ms, i) => ms + i.durationSec * 1000, 0)
    : null

  const setField = (key: SettingKey, value: string) => setForm((f) => ({ ...f, [key]: value }))

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
    if (valid) onStart(toSettings(form))
  }

  return (
    <main className="settings">
      <h1 className="settings__title">New Workout</h1>
      <form className="settings__form" onSubmit={submit} noValidate>
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
        <p className="settings__total">Total {totalMs === null ? '–' : formatTime(totalMs)}</p>
        <button type="submit" className="settings__start" disabled={!valid}>
          Start
        </button>
      </form>
    </main>
  )
}

export default SettingsScreen
