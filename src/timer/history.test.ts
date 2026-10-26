import { describe, expect, it, vi } from 'vitest'
import { getMockSession } from '../test/factories.ts'
import {
  dailyTotals,
  dayCount,
  formatDuration,
  loadSessions,
  minuteTicks,
  parseDateInput,
  recordSession,
  toDateInput,
  validateRange,
} from './history.ts'

// Local times, so day boundaries are the device's.
const at = (day: number, hour = 7) => new Date(2026, 9, day, hour).getTime()
const NOW = at(26, 18) // Mon 26 Oct 2026, 6 pm

describe('recordSession / loadSessions', () => {
  it('returns no sessions when nothing is recorded', () => {
    expect(loadSessions()).toEqual([])
  })

  it('records sessions in order', () => {
    recordSession(getMockSession({ startedAt: at(25) }))
    recordSession(getMockSession({ startedAt: at(26), activeMs: 60_000 }))

    expect(loadSessions()).toEqual([
      getMockSession({ startedAt: at(25) }),
      getMockSession({ startedAt: at(26), activeMs: 60_000 }),
    ])
  })

  it('recording the same session twice keeps one entry, with the later time', () => {
    recordSession(getMockSession({ activeMs: 60_000 }))
    recordSession(getMockSession({ activeMs: 90_000 }))

    expect(loadSessions()).toEqual([getMockSession({ activeMs: 90_000 })])
  })

  it('skips a session under a second', () => {
    recordSession(getMockSession({ activeMs: 999 }))

    expect(loadSessions()).toEqual([])
  })

  it('drops sessions over 400 days older than the one recorded', () => {
    const old = getMockSession({ startedAt: new Date(2025, 8, 1).getTime() })
    localStorage.setItem('interval-app:history', JSON.stringify([old]))

    recordSession(getMockSession())

    expect(loadSessions()).toEqual([getMockSession()])
  })

  it.each([
    ['not JSON', '{oops', []],
    ['not a list', '{}', []],
    ['corrupt entries', JSON.stringify([{ startedAt: 'x', activeMs: 1 }, { startedAt: 1 }, getMockSession()]), [getMockSession()]],
  ])('ignores corrupt data (%s)', (_label, raw, expected) => {
    localStorage.setItem('interval-app:history', raw)

    expect(loadSessions()).toEqual(expected)
  })

  it('returns no sessions, and recording does not throw, when storage is unavailable', () => {
    const denied = () => {
      throw new DOMException('Storage is disabled', 'SecurityError')
    }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(denied)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(denied)

    expect(() => recordSession(getMockSession())).not.toThrow()
    expect(loadSessions()).toEqual([])
  })
})

describe('dailyTotals', () => {
  it('gives one entry per day, oldest first, ending today', () => {
    const days = dailyTotals([], 7, NOW)

    expect(days).toHaveLength(7)
    expect(days[0].dayStart).toBe(new Date(2026, 9, 20).getTime())
    expect(days[6].dayStart).toBe(new Date(2026, 9, 26).getTime())
  })

  it('adds up the sessions of each day by the day they started', () => {
    const days = dailyTotals(
      [
        getMockSession({ startedAt: at(26, 7), activeMs: 60_000 }),
        getMockSession({ startedAt: at(26, 17), activeMs: 30_000 }),
        getMockSession({ startedAt: new Date(2026, 9, 24, 23, 59).getTime(), activeMs: 600_000 }),
      ],
      7,
      NOW,
    )

    expect(days[6]).toMatchObject({ activeMs: 90_000, sessions: 2 })
    expect(days[4]).toMatchObject({ activeMs: 600_000, sessions: 1 })
    expect(days[5]).toMatchObject({ activeMs: 0, sessions: 0 })
  })

  it('leaves out sessions before the range', () => {
    const days = dailyTotals([getMockSession({ startedAt: at(19) })], 7, NOW)

    expect(days.every((d) => d.activeMs === 0)).toBe(true)
  })
})

describe('formatDuration', () => {
  it.each([
    [0, '0s'],
    [45_900, '45s'],
    [498_000, '8m 18s'],
    [60_000, '1m 00s'],
    [3_900_000, '1h 05m'],
  ])('formats %i ms as %s', (ms, text) => {
    expect(formatDuration(ms)).toBe(text)
  })
})

describe('minuteTicks', () => {
  it.each([
    [0, [0, 1]],
    [90_000, [0, 1, 2]],
    [498_000, [0, 5, 10]],
    [25 * 60_000, [0, 10, 20, 30]],
    [3 * 3_600_000, [0, 60, 120, 180]],
  ])('for a max of %i ms gives %j', (maxMs, ticks) => {
    expect(minuteTicks(maxMs)).toEqual(ticks)
  })
})

describe('dailyTotals for a range ending before today', () => {
  it('ends on the day containing `last`', () => {
    const days = dailyTotals([getMockSession({ startedAt: at(10) })], 5, at(12))

    expect(days.map((d) => new Date(d.dayStart).getDate())).toEqual([8, 9, 10, 11, 12])
    expect(days[2].activeMs).toBe(498_000)
  })
})

describe('date fields', () => {
  it('toDateInput and parseDateInput round-trip a local day', () => {
    expect(toDateInput(at(5, 23))).toBe('2026-10-05')
    expect(parseDateInput('2026-10-05')).toBe(new Date(2026, 9, 5).getTime())
  })

  it.each(['', '2026-13-01', '2026-02-31', '26-10-05'])('parseDateInput rejects %j', (text) => {
    expect(parseDateInput(text)).toBeNull()
  })

  it('dayCount counts both ends, across a DST change', () => {
    expect(dayCount(at(26), at(26))).toBe(1)
    expect(dayCount(new Date(2026, 2, 1).getTime(), new Date(2026, 3, 30).getTime())).toBe(61)
  })
})

describe('validateRange', () => {
  it('returns the range as day starts', () => {
    expect(validateRange('2026-10-01', '2026-10-15', NOW)).toEqual({
      from: new Date(2026, 9, 1).getTime(),
      to: new Date(2026, 9, 15).getTime(),
    })
  })

  it('accepts a single day, today, and exactly 90 days', () => {
    expect(validateRange('2026-10-26', '2026-10-26', NOW)).not.toHaveProperty('message')
    expect(validateRange('2026-07-29', '2026-10-26', NOW)).not.toHaveProperty('message')
  })

  it.each([
    ['', '2026-10-15', { field: 'from', message: 'Choose a start date.' }],
    ['2026-10-01', '', { field: 'to', message: 'Choose an end date.' }],
    ['2026-10-01', '2026-10-27', { field: 'to', message: "End can't be after today." }],
    ['2026-10-16', '2026-10-15', { field: 'from', message: 'Start must be on or before the end.' }],
    ['2026-07-28', '2026-10-26', { field: 'from', message: 'Choose a range of up to 90 days.' }],
  ])('rejects %j to %j', (from, to, error) => {
    expect(validateRange(from, to, NOW)).toEqual(error)
  })
})
