// Past workout sessions, for the Workout History screen. A session is recorded
// when it ends: finished, or reset part-way through. Like the saved timer,
// every failure (corrupt data, blocked storage) is quiet.

export interface WorkoutSession {
  // When Start was tapped; also the session's id, so recording the same
  // session twice (StrictMode, a Done shown after reopening) keeps one entry.
  startedAt: number
  // Time spent working out: elapsed time without pauses.
  activeMs: number
}

const HISTORY_KEY = 'interval-app:history'

// Old sessions are dropped on write: the longest range shown is 90 days.
const KEEP_MS = 400 * 24 * 60 * 60 * 1000

const isSession = (value: unknown): value is WorkoutSession => {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.startedAt === 'number' &&
    Number.isFinite(v.startedAt) &&
    typeof v.activeMs === 'number' &&
    v.activeMs >= 0
  )
}

export function loadSessions(): WorkoutSession[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (raw === null) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isSession) : []
  } catch {
    return []
  }
}

// Sessions under a second (Start then straight away Reset) aren't recorded.
export function recordSession(session: WorkoutSession) {
  if (session.activeMs < 1000) return
  const cutoff = session.startedAt - KEEP_MS
  const others = loadSessions().filter((s) => s.startedAt !== session.startedAt && s.startedAt >= cutoff)
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify([...others, session]))
  } catch {
    // Storage unavailable or full: this session just isn't in the history.
  }
}

export const RANGES = [7, 30, 90] as const
export type RangeDays = (typeof RANGES)[number]

// A custom range is one bar per day too, so it's capped like the longest preset.
export const MAX_RANGE_DAYS = 90

export interface DayTotal {
  // Local midnight that starts the day.
  dayStart: number
  activeMs: number
  sessions: number
}

export const startOfDay = (ms: number) => {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// Inclusive count of calendar days, first to last. Rounded, because a day
// with a DST change isn't 24h.
export const dayCount = (first: number, last: number) =>
  Math.round((startOfDay(last) - startOfDay(first)) / 86_400_000) + 1

// <input type="date"> values ("2026-10-26") as local midnight, and back.
export const toDateInput = (ms: number) => {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const parseDateInput = (text: string): number | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (!match) return null
  const [y, m, d] = match.slice(1).map(Number)
  const date = new Date(y, m - 1, d)
  // Rejects dates that roll over, like 2026-02-31.
  return date.getMonth() === m - 1 && date.getDate() === d ? date.getTime() : null
}

export type CustomRange = { from: number; to: number }
export type RangeError = { field: 'from' | 'to'; message: string }

// The From/To fields as a range of day starts, or the error to show on one field.
export function validateRange(fromText: string, toText: string, now: number): CustomRange | RangeError {
  const from = parseDateInput(fromText)
  const to = parseDateInput(toText)
  if (from === null) return { field: 'from', message: 'Choose a start date.' }
  if (to === null) return { field: 'to', message: 'Choose an end date.' }
  if (to > startOfDay(now)) return { field: 'to', message: "End can't be after today." }
  if (from > to) return { field: 'from', message: 'Start must be on or before the end.' }
  if (dayCount(from, to) > MAX_RANGE_DAYS) {
    return { field: 'from', message: `Choose a range of up to ${MAX_RANGE_DAYS} days.` }
  }
  return { from, to }
}

// One entry per local calendar day, oldest first, ending with the day that
// contains `last` (today, for the presets). A session counts on the day it started.
export function dailyTotals(sessions: WorkoutSession[], days: number, last: number): DayTotal[] {
  const end = new Date(startOfDay(last))
  const totals = Array.from({ length: days }, (_, i): DayTotal => {
    const d = new Date(end)
    d.setDate(end.getDate() - (days - 1 - i)) // setDate, not 24h steps: DST days aren't 24h
    return { dayStart: d.getTime(), activeMs: 0, sessions: 0 }
  })
  const byDay = new Map(totals.map((t) => [t.dayStart, t]))
  for (const s of sessions) {
    const total = byDay.get(startOfDay(s.startedAt))
    if (total) {
      total.activeMs += s.activeMs
      total.sessions += 1
    }
  }
  return totals
}

// "45s", "8m 18s", "1h 05m". Rounded down: a total never claims time not spent.
export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`
  return `${s}s`
}

// Clean minute gridlines: the smallest step that covers the max in ≤ 4 steps.
export function minuteTicks(maxMs: number): number[] {
  const maxMin = maxMs / 60_000
  const step = [1, 2, 5, 10, 15, 30, 60, 120].find((st) => st * 4 >= maxMin) ?? 240
  const count = Math.max(1, Math.ceil(maxMin / step))
  return Array.from({ length: count + 1 }, (_, i) => i * step)
}
