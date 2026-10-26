import { useState, type KeyboardEvent, type PointerEvent } from 'react'
import {
  dailyTotals,
  dayCount,
  formatDuration,
  MAX_RANGE_DAYS,
  minuteTicks,
  RANGES,
  startOfDay,
  toDateInput,
  validateRange,
  type CustomRange,
  type RangeDays,
  type WorkoutSession,
} from './history.ts'
import './HistoryScreen.css'

interface Props {
  sessions: WorkoutSession[]
  // The top-bar back arrow: back to the saved workouts.
  onBack: () => void
  // For tests; the days shown end with the day containing `now`.
  now?: number
}

const dayLabel = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
const shortDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
const weekdayLetter = (ms: number) => new Date(ms).toLocaleDateString(undefined, { weekday: 'narrow' })
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

// Total workout time per day, as a bar chart, over the last 7, 30 or 90 days
// or a custom range of dates. Tap or drag across the chart (or use the arrow
// keys) to read one day.
function HistoryScreen({ sessions, onBack, now }: Props) {
  // Read once on open, so the days don't shift under the reader.
  const [today] = useState(() => now ?? Date.now())
  const [range, setRange] = useState<RangeDays | 'custom'>(7)
  // The From/To fields as typed, and the last valid range they gave: while a
  // field is invalid, the chart keeps showing that range.
  const [draft, setDraft] = useState({ from: '', to: '' })
  const [custom, setCustom] = useState<CustomRange>({ from: today, to: today })
  // The day being read out, as an index into `days`; null = none yet.
  const [selected, setSelected] = useState<number | null>(null)

  const days =
    range === 'custom'
      ? dailyTotals(sessions, dayCount(custom.from, custom.to), custom.to)
      : dailyTotals(sessions, range, today)
  const first = days[0].dayStart
  const last = days[days.length - 1].dayStart
  const endsToday = last === startOfDay(today)
  const checked = range === 'custom' ? validateRange(draft.from, draft.to, today) : null
  const rangeError = checked && 'message' in checked ? checked : null
  const totalMs = days.reduce((ms, d) => ms + d.activeMs, 0)
  const workouts = days.reduce((n, d) => n + d.sessions, 0)
  const ticks = minuteTicks(Math.max(...days.map((d) => d.activeMs)))
  const scaleMs = ticks[ticks.length - 1] * 60_000
  const picked = selected === null ? null : days[selected]

  const chooseRange = (next: RangeDays) => {
    setRange(next)
    setSelected(null)
  }

  // Custom starts from the days already shown, so the fields are never blank.
  const chooseCustom = () => {
    if (range === 'custom') return
    setDraft({ from: toDateInput(first), to: toDateInput(last) })
    setCustom({ from: first, to: last })
    setRange('custom')
    setSelected(null)
  }

  const editDate = (field: 'from' | 'to', value: string) => {
    const next = { ...draft, [field]: value }
    setDraft(next)
    const result = validateRange(next.from, next.to, today)
    if (!('message' in result)) {
      setCustom(result)
      setSelected(null)
    }
  }

  // The pointer picks the day under it, so a thin bar needn't be hit exactly.
  const pickAt = (event: PointerEvent<HTMLDivElement>) => {
    const { left, width } = event.currentTarget.getBoundingClientRect()
    if (width === 0) return
    const index = Math.floor(((event.clientX - left) / width) * days.length)
    setSelected(Math.min(days.length - 1, Math.max(0, index)))
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key]
    if (!step) return
    event.preventDefault()
    const from = selected ?? days.length - (step > 0 ? 1 : 0)
    setSelected(Math.min(days.length - 1, Math.max(0, from + step)))
  }

  // Under the bars: every day's initial for a week or less; otherwise the range's ends.
  const perDayLabels = days.length <= 7
  const lastLabel = endsToday ? 'Today' : shortDate(last)
  const xLabels = perDayLabels ? days.map((d) => weekdayLetter(d.dayStart)) : [shortDate(first), lastLabel]
  const rangeText = days.length === 1 ? dayLabel(first) : `${dayLabel(first)} – ${endsToday ? 'Today' : dayLabel(last)}`

  return (
    <main className="history">
      {/* Material 3 small top app bar: up arrow, then the title. */}
      <header className="history__bar">
        <button type="button" className="history__back" aria-label="Back" onClick={onBack}>
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
        </button>
        <h1 className="history__title">Workout History</h1>
      </header>

      {/* The time range scopes everything below it. */}
      <div className="history__ranges" role="group" aria-label="Time range">
        {RANGES.map((n) => (
          <button
            key={n}
            type="button"
            className="history__range"
            aria-pressed={range === n}
            onClick={() => chooseRange(n)}
          >
            {n} days
          </button>
        ))}
        <button
          type="button"
          className="history__range"
          aria-pressed={range === 'custom'}
          onClick={chooseCustom}
        >
          Custom
        </button>
      </div>

      {range === 'custom' && (
        <div className="history__dates">
          {(['from', 'to'] as const).map((field) => {
            const id = `history-${field}`
            const error = rangeError?.field === field ? rangeError.message : null
            return (
              <div className="history__date" key={field}>
                <label htmlFor={id}>{field === 'from' ? 'From' : 'To'}</label>
                {/* Android opens its own date picker for these. */}
                <input
                  id={id}
                  type="date"
                  value={draft[field]}
                  max={toDateInput(today)}
                  onChange={(e) => editDate(field, e.target.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? `${id}-error` : undefined}
                />
                {error && (
                  <p id={`${id}-error`} className="history__date-error" role="alert">
                    {error}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
      <p className="history__range-text">
        {rangeText}
        {range === 'custom' && ` · up to ${MAX_RANGE_DAYS} days`}
      </p>

      <dl className="history__stats">
        <div className="history__stat history__stat--hero">
          <dt>Total</dt>
          <dd>{formatDuration(totalMs)}</dd>
        </div>
        <div className="history__stat">
          <dt>Workouts</dt>
          <dd>{workouts}</dd>
        </div>
        <div className="history__stat">
          <dt>Daily average</dt>
          <dd>{formatDuration(totalMs / days.length)}</dd>
        </div>
      </dl>

      <section className="history__chart-card" aria-labelledby="history-chart-title">
        <h2 id="history-chart-title" className="history__chart-title">
          Workout time per day
        </h2>
        <p id="history-readout" className="history__readout" aria-live="polite">
          {picked ? (
            <>
              <strong>{formatDuration(picked.activeMs)}</strong>{' '}
              {dayLabel(picked.dayStart)}
              {picked.sessions > 0 && ` · ${plural(picked.sessions, 'workout')}`}
            </>
          ) : (
            'Tap a day to see its total'
          )}
        </p>

        <div className="history__plot">
          {/* Gridlines at clean minutes, labelled at the left. */}
          <div className="history__grid" aria-hidden="true">
            {ticks.map((min) => (
              <div key={min} className="history__gridline" style={{ bottom: `${(min / ticks[ticks.length - 1]) * 100}%` }}>
                <span className="history__tick">{min}m</span>
              </div>
            ))}
          </div>
          <div
            className="history__bars"
            data-dense={days.length > 30 || undefined}
            tabIndex={0}
            aria-label="Daily workout time. Use the left and right arrow keys to pick a day."
            aria-describedby="history-readout"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture?.(e.pointerId)
              pickAt(e)
            }}
            onPointerMove={(e) => {
              if (e.buttons) pickAt(e)
            }}
            onKeyDown={onKeyDown}
          >
            {days.map((d, i) => (
              <div key={d.dayStart} className="history__slot" data-selected={i === selected || undefined}>
                {d.activeMs > 0 && (
                  <div className="history__bar-mark" style={{ height: `${(d.activeMs / scaleMs) * 100}%` }} />
                )}
              </div>
            ))}
          </div>
          {totalMs === 0 && (
            <p className="history__empty">
              {range === 'custom'
                ? `No workouts from ${shortDate(first)} to ${shortDate(last)}.`
                : `No workouts in the last ${range} days.`}
            </p>
          )}
        </div>
        <div className="history__x" data-ends={!perDayLabels || undefined} aria-hidden="true">
          {xLabels.map((label, i) => (
            <span key={i}>{label}</span>
          ))}
        </div>
      </section>

      {/* The same numbers without the chart, newest first. */}
      {totalMs > 0 && (
        <details className="history__table">
          <summary>Daily totals</summary>
          <table>
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Workouts</th>
                <th scope="col">Time</th>
              </tr>
            </thead>
            <tbody>
              {days
                .filter((d) => d.activeMs > 0)
                .reverse()
                .map((d) => (
                  <tr key={d.dayStart}>
                    <th scope="row">{dayLabel(d.dayStart)}</th>
                    <td>{d.sessions}</td>
                    <td>{formatDuration(d.activeMs)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </details>
      )}
    </main>
  )
}

export default HistoryScreen
