import { describe, expect, it } from 'vitest'
import { calculateNextDueDate, getNextOccurrence } from '../src/lib/recurrence'

describe('calendar recurrence', () => {
  it('advances weekday tasks to the next selected weekday', () => {
    expect(getNextOccurrence('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', '2026-09-11')).toBe('2026-09-14')
    expect(getNextOccurrence('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', '2026-09-14')).toBe('2026-09-15')
  })
  it('keeps local calendar days through daylight saving changes', () => {
    expect(getNextOccurrence('FREQ=DAILY', '2026-03-08')).toBe('2026-03-09')
    expect(getNextOccurrence('FREQ=DAILY', '2026-11-01')).toBe('2026-11-02')
  })
  it('clamps month end and leap day without rolling into another month', () => {
    expect(getNextOccurrence('FREQ=MONTHLY;BYMONTHDAY=31', '2026-01-31')).toBe('2026-02-28')
    expect(getNextOccurrence('FREQ=YEARLY', '2024-02-29')).toBe('2025-02-28')
  })
  it('rejects invalid/non-advancing rules instead of hanging or inventing daily tasks', () => {
    expect(() => getNextOccurrence('FREQ=DAILY;INTERVAL=0', '2026-09-12')).toThrow()
    expect(() => getNextOccurrence('FREQ=DAILY;INTERVAL=-1', '2026-09-12')).toThrow()
    expect(() => getNextOccurrence('FREQ=HOURLY', '2026-09-12')).toThrow()
  })
  it.each([
    'FREQ=DAILY;COUNT=3',
    'FREQ=DAILY;UNTIL=20260930T000000Z',
    'FREQ=MONTHLY;BYSETPOS=1',
    'FREQ=WEEKLY;WKST=SU',
    'FREQ=DAILY;INTERVAL=2x',
    'FREQ=DAILY;INTERVAL=2.5',
    'FREQ=DAILY;INTERVAL=',
    'FREQ=MONTHLY;BYMONTHDAY=15x',
    'FREQ=WEEKLY;BYDAY=ZZ',
    'FREQ=WEEKLY;BYDAY=MO,ZZ',
    'FREQ=DAILY;BYDAY=MO',
    'FREQ=YEARLY;BYMONTHDAY=1',
    'FREQ=DAILY;FREQ=WEEKLY',
    'INTERVAL=2',
    'FREQ=DAILY=EXTRA',
  ])('rejects malformed or unsupported schedule %s', rule => {
    expect(() => getNextOccurrence(rule, '2026-09-12')).toThrow()
  })
  it.each([
    ['FREQ=DAILY;INTERVAL=3', '2026-09-12', '2026-09-15'],
    ['FREQ=WEEKLY;BYDAY=TU', '2026-09-12', '2026-09-15'],
    ['FREQ=WEEKLY;INTERVAL=2', '2026-09-12', '2026-09-26'],
    ['FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,FR', '2026-09-11', '2026-09-21'],
    ['FREQ=MONTHLY;INTERVAL=2', '2026-09-12', '2026-11-12'],
    ['FREQ=MONTHLY;BYMONTHDAY=31', '2026-02-28', '2026-03-31'],
    ['FREQ=YEARLY;INTERVAL=2', '2024-02-29', '2026-02-28'],
  ])('preserves supported schedule %s', (rule, date, expected) => {
    expect(getNextOccurrence(rule, date)).toBe(expected)
  })
  it('supports the stored after_completion name and skips missed fixed dates', () => {
    const now = new Date('2026-09-12T12:00:00')
    expect(calculateNextDueDate('FREQ=DAILY', '2026-09-01', 'fixed', now)).toBe('2026-09-13')
    expect(calculateNextDueDate('FREQ=WEEKLY', '2026-09-01', 'after_completion', now)).toBe('2026-09-19')
  })
})
