import { describe, expect, it } from 'vitest'
import { planReminders, isQuietTime, type ReminderInput } from '../src/lib/reminders/planner'

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
