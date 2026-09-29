import { describe, expect, it } from 'vitest'
import { parseTaskInput } from '../src/lib/nlp'

const reference = new Date(2026, 8, 12, 12, 0)

describe('task capture interpretation', () => {
  it('separates persistent alerts from task recurrence and requires AM/PM for a bare 10', () => {
    const task = parseTaskInput('Call the dentist tomorrow at 10 and remind me every minute until it’s done.', reference)

    expect(task).toMatchObject({
      title: 'Call the dentist',
      dueDate: '2026-09-13',
      dueTime: null,
      recurrence: null,
      reminderMode: 'persistent',
      reminderIntervalSeconds: 60,
      ambiguousTime: { am: '10:00', pm: '22:00' },
    })
  })

  it('never enables reminders just because a due time was recognized', () => {
    expect(parseTaskInput('Call the dentist tomorrow at 10pm', reference)).toMatchObject({
      title: 'Call the dentist', dueTime: '22:00', reminderMode: 'off', ambiguousTime: null,
    })
  })

  it.each([
    ['tomorrow at noon', '12:00'],
    ['tomorrow at midnight', '00:00'],
    ['tomorrow at 22:00', '22:00'],
    ['tomorrow at 10am', '10:00'],
  ])('retains explicit times: %s', (dateText, dueTime) => {
    expect(parseTaskInput(`Call dentist ${dateText}`, reference)).toMatchObject({ dueTime, ambiguousTime: null })
  })

  it('does not infer a date for an ambiguous time without a date', () => {
    expect(parseTaskInput('Call dentist at 10', reference)).toMatchObject({
      dueDate: null, dueTime: null, ambiguousTime: { am: '10:00', pm: '22:00' },
    })
  })

  it('supports one alert only when explicitly requested', () => {
    expect(parseTaskInput('Remind me to call dentist tomorrow at 9am', reference)).toMatchObject({
      title: 'call dentist', dueTime: '09:00', reminderMode: 'once', reminderIntervalSeconds: null,
    })
  })

  it('preserves task recurrence, priority, project and labels alongside a reminder', () => {
    expect(parseTaskInput('Take bins out every monday p2 #Home @outside and remind me every 5 minutes until done', reference)).toMatchObject({
      title: 'Take bins out', priority: 2, projectName: 'Home', labelNames: ['outside'],
      recurrence: 'FREQ=WEEKLY;BYDAY=MO', reminderMode: 'persistent', reminderIntervalSeconds: 300,
    })
  })

  it('preserves monthly day selection', () => {
    expect(parseTaskInput('Pay rent every month on the 1st', reference)).toMatchObject({
      title: 'Pay rent', dueDate: '2026-10-01', recurrence: 'FREQ=MONTHLY;BYMONTHDAY=1',
    })
  })

  it('does not silently drop a second recurrence day', () => {
    const task = parseTaskInput('Put bins out every Monday and Friday', reference)
    expect(task).toMatchObject({ recurrence: null, requiresReview: true })
    expect(task.warnings.join(' ')).toMatch(/repeat/i)
  })

  it('requires review instead of silently picking the first of several dates', () => {
    const task = parseTaskInput('Call dentist tomorrow and buy milk Friday', reference)
    expect(task).toMatchObject({ dueDate: null, dueTime: null, requiresReview: true })
    expect(task.title).toContain('tomorrow')
    expect(task.title).toContain('Friday')
    expect(task.warnings.join(' ')).toMatch(/multiple dates/i)
  })

  it('requires review of a time range instead of discarding its end', () => {
    const task = parseTaskInput('Call dentist tomorrow from 10am to 11am', reference)
    expect(task).toMatchObject({ dueDate: null, dueTime: null, requiresReview: true })
    expect(task.warnings.join(' ')).toMatch(/range/i)
  })

  it('warns when multiple task clauses will become a single task', () => {
    const task = parseTaskInput('Call dentist and buy milk tomorrow', reference)
    expect(task.requiresReview).toBe(true)
    expect(task.warnings.join(' ')).toMatch(/one task/i)
  })

  it.each(['3 minutes', '0 minutes', 'day', 'four minutes'])('does not substitute a different reminder interval for %s', interval => {
    const task = parseTaskInput(`Call dentist tomorrow at 9am and remind me every ${interval} until done`, reference)
    expect(task).toMatchObject({ reminderMode: 'persistent', reminderIntervalSeconds: null, recurrence: null })
    expect(task.warnings.join(' ')).toMatch(/interval/i)
  })

  it('does not enable a negated reminder instruction', () => {
    const task = parseTaskInput('Call dentist tomorrow at 9am and do not remind me every minute', reference)
    expect(task.reminderMode).toBe('off')
    expect(task.requiresReview).toBe(true)
  })

  it('does not turn repeated reminder wording with an unknown interval into a once-only alert', () => {
    const task = parseTaskInput('Call dentist tomorrow at 9am and remind me every so often', reference)
    expect(task).toMatchObject({ reminderMode: 'off', requiresReview: true })
    expect(task.warnings.join(' ')).toMatch(/reminder/i)
  })

  it('does not treat an ordinary numeric part of a title as a date', () => {
    expect(parseTaskInput('Read chapter 10', reference)).toMatchObject({ title: 'Read chapter 10', dueDate: null, dueTime: null })
  })
})
