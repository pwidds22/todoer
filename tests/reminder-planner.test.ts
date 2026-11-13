import { describe, expect, it } from 'vitest'
import { planReminders, isQuietTime, REMINDER_PAUSE_TASK_ID, type ReminderInput } from '../src/lib/reminders/planner'
import { REMINDER_QUEUE_LIMIT } from '../src/lib/reminders/policy'

const now = new Date('2026-09-12T10:00:00').getTime()
const task: ReminderInput = {
  id: 'task-a', title: 'Call dentist', due_date: '2026-09-12', due_time: '10:00',
  is_completed: false, is_deleted: false, updated_at: 'revision-1',
  preference: { enabled: true, mode: 'persistent', intervalSeconds: 60 },
}
const settings = { quietEnabled: true, quietStart: '22:00', quietEnd: '07:00' }

describe('reminder planning', () => {
  it('a once-only delivery keeps its receipt identity through focus suppression', () => {
    const once = { ...task, preference: { ...task.preference, mode: 'once' as const } }
    const before = planReminders([once], { now, settings })[0]
    const focus = planReminders([once], { now, settings, focus: { taskId: task.id, until: now + 600000 } })[0]
    expect(focus.id).toBe(before.id)
    expect(focus.at).toBe(now + 600000)
  })
  it('supports one minute persistence with a finite queue', () => {
    const result = planReminders([task], { now, settings, limit: 3 })
    expect(result.map(r => r.at)).toEqual([now + 1000, now + 60000, now + 120000])
    expect(new Set(result.map(r => r.id)).size).toBe(3)
  })
  it('requires personal consent and an explicit date/time', () => {
    expect(planReminders([{ ...task, preference: { ...task.preference, enabled: false } }], { now, settings })).toEqual([])
    expect(planReminders([{ ...task, due_time: null }], { now, settings })).toEqual([])
  })
  it('removes completed/deleted reminders and does not replay past slots in a burst', () => {
    expect(planReminders([{ ...task, is_completed: true }], { now, settings })).toEqual([])
    expect(planReminders([{ ...task, is_deleted: true }], { now, settings })).toEqual([])
    const result = planReminders([task], { now: now + 300000, settings, limit: 2 })
    expect(result.map(r => r.at)).toEqual([now + 301000, now + 360000])
  })
  it('snoozes to a future instant and suppresses the linked focus task', () => {
    const snoozed = { ...task, preference: { ...task.preference, snoozeUntil: new Date(now + 600000).toISOString() } }
    expect(planReminders([snoozed], { now, settings, limit: 1 })[0].at).toBe(now + 600000)
    const result = planReminders([task], { now, settings, limit: 1, focus: { taskId: task.id, until: now + 1500000 } })
    expect(result[0].at).toBe(now + 1500000)
  })
  it('honors overnight quiet hours at boundaries', () => {
    expect(isQuietTime(new Date('2026-09-12T22:00:00'), settings)).toBe(true)
    expect(isQuietTime(new Date('2026-09-13T06:59:00'), settings)).toBe(true)
    expect(isQuietTime(new Date('2026-09-13T07:00:00'), settings)).toBe(false)
    const bedtime = new Date('2026-09-12T23:00:00').getTime()
    expect(planReminders([task], { now: bedtime, settings, limit: 1 })[0].at).toBe(new Date('2026-09-13T07:00:00').getTime())
  })
  it('uses changed identity after rescheduling and clamps unsafe intervals', () => {
    const first = planReminders([task], { now, settings, limit: 1 })[0]
    const changed = planReminders([{ ...task, due_time: '11:00' }], { now, settings, limit: 1 })[0]
    expect(changed.id).not.toBe(first.id)
    const result = planReminders([{ ...task, preference: { ...task.preference, intervalSeconds: -30 } }], { now, settings, limit: 2 })
    expect(result[1].at - now).toBeGreaterThanOrEqual(60000)
  })
  it('supports a single reminder and a slower native background floor', () => {
    const once = { ...task, preference: { ...task.preference, mode: 'once' as const } }
    expect(planReminders([once], { now, settings })).toHaveLength(1)
    const result = planReminders([task], { now, settings, limit: 3, minimumIntervalSeconds: 600 })
    expect(result.map(r => r.at)).toEqual([now + 1000, now + 600000, now + 1200000])
  })
})

describe('shared queue budget', () => {
  const at = (time: string, day = '12') => new Date(`2026-09-${day}T${time}:00`).getTime()
  const nag: ReminderInput = { ...task, id: 'nag', title: 'Overdue', due_time: '09:30' }
  const dentist: ReminderInput = { ...task, id: 'dentist', title: 'Dentist', due_time: '11:00', preference: { enabled: true, mode: 'once', intervalSeconds: 60 } }
  const pickup: ReminderInput = { ...task, id: 'pickup', title: 'Pickup', due_time: '13:00', preference: { enabled: true, mode: 'persistent', intervalSeconds: 900 } }

  it('gives every task its first alert before an overdue task repeats', () => {
    const result = planReminders([nag, dentist, pickup], { now, settings })
    expect(result).toHaveLength(REMINDER_QUEUE_LIMIT)
    expect(result.filter(r => r.taskId === 'dentist').map(r => r.at)).toEqual([at('11:00')])
    expect(result.filter(r => r.taskId === 'pickup').map(r => r.at)).toEqual([at('13:00')])
    expect(result.filter(r => r.taskId === 'nag')).toHaveLength(REMINDER_QUEUE_LIMIT - 2)
  })
  it('keeps the earliest first alerts when tasks outnumber slots', () => {
    const many = [4, 1, 3, 2, 5].map(hour => ({ ...task, id: `t${hour}`, due_time: `1${hour}:00` }))
    expect(planReminders(many, { now, settings, limit: 3 }).map(r => r.taskId)).toEqual(['t1', 't2', 't3'])
  })
  it('fills the remaining slots with the soonest repeats', () => {
    const result = planReminders([nag, pickup], { now, settings, limit: 4 })
    expect(result.map(r => [r.taskId, r.at])).toEqual([['nag', now + 1000], ['nag', now + 60000], ['nag', now + 120000], ['pickup', at('13:00')]])
  })

  it('ends a persistent queue with a pause notice at the first alert that did not fit', () => {
    const result = planReminders([nag], { now, settings, limit: 4, pauseNotice: true })
    expect(result.map(r => r.taskId)).toEqual(['nag', 'nag', 'nag', REMINDER_PAUSE_TASK_ID])
    const notice = result[3]
    expect(notice.at).toBe(now + 180000)
    expect(notice.body).toMatch(/Open Todoer/)
    expect(new Set(result.map(r => r.id)).size).toBe(4)
  })
  it('pauses at the earliest point any persistent task stops, even when another task keeps its first alert', () => {
    const result = planReminders([nag, pickup], { now, settings, limit: 4, pauseNotice: true })
    expect(result.map(r => r.taskId)).toEqual(['nag', 'nag', REMINDER_PAUSE_TASK_ID, 'pickup'])
    expect(result[2].at).toBe(now + 120000)
  })
  it('places the pause notice after the queue when everything fits inside the horizon', () => {
    const hourly = { ...task, preference: { ...task.preference, intervalSeconds: 3600 } }
    const result = planReminders([hourly], { now, settings: { ...settings, quietEnabled: false }, limit: 40, pauseNotice: true })
    const last = result.at(-2)!
    expect(result.at(-1)).toMatchObject({ taskId: REMINDER_PAUSE_TASK_ID, at: last.at + 3600000 })
  })
  it('moves the pause notice out of quiet hours', () => {
    const lateNag = { ...task, due_time: '21:57' }
    const result = planReminders([lateNag], { now: at('21:57'), settings, limit: 4, pauseNotice: true })
    expect(result.at(-1)).toMatchObject({ taskId: REMINDER_PAUSE_TASK_ID, at: at('07:00', '13') })
  })
  it('only adds a pause notice for persistent reminders that were requested with room for it', () => {
    const once = { ...task, preference: { ...task.preference, mode: 'once' as const } }
    expect(planReminders([once], { now, settings, pauseNotice: true }).map(r => r.taskId)).toEqual(['task-a'])
    expect(planReminders([nag], { now, settings, limit: 4 }).some(r => r.taskId === REMINDER_PAUSE_TASK_ID)).toBe(false)
    expect(planReminders([nag], { now, settings, limit: 1, pauseNotice: true }).map(r => r.taskId)).toEqual(['nag'])
  })
  it('gives a moved pause notice a new identity so a delivered one is cleared and replaced', () => {
    const first = planReminders([nag], { now, settings, limit: 4, pauseNotice: true }).at(-1)!
    const later = planReminders([nag], { now: now + 60000, settings, limit: 4, pauseNotice: true }).at(-1)!
    expect(later.at).toBeGreaterThan(first.at)
    expect(later.id).not.toBe(first.id)
    expect(later.revision).not.toBe(first.revision)
  })
})
