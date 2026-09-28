import { describe, expect, it } from 'vitest'
import { getReminderPolicy } from '@/lib/reminders/policy'
import { planReminders, type ReminderInput } from '@/lib/reminders/planner'

const now = new Date('2026-09-14T10:00:00').getTime()
const settings = { quietEnabled: false, quietStart: '22:00', quietEnd: '07:00' }
const task: ReminderInput = {
  id: 'task-a', title: 'Call dentist', due_date: '2026-09-14', due_time: '10:00',
  is_completed: false, is_deleted: false,
  preference: { enabled: true, mode: 'persistent', intervalSeconds: 60 },
}

describe('platform reminder policy', () => {
  it.each([
    { platform: 'ios', offsets: [1000, 60_000, 120_000] },
    { platform: 'android', offsets: [1000, 600_000, 1_200_000] },
  ])('requests the $platform interval without exceeding the finite queue', ({ platform, offsets }) => {
    const policy = getReminderPolicy(platform)
    const planned = planReminders([task], { now, settings, ...policy.planning })
    expect(planned.slice(0, 3).map(n => n.at - now)).toEqual(offsets)
    expect(planned).toHaveLength(32)
    expect(planned.every(n => n.at <= now + 86_400_000)).toBe(true)
  })

  it.each(['ios', 'android'])('keeps a 24-hour horizon on %s', platform => {
    const policy = getReminderPolicy(platform)
    const later = { ...task, due_date: '2026-09-15', due_time: '10:01' }
    expect(planReminders([later], { now, settings, ...policy.planning })).toEqual([])
  })

  it.each([
    { platform: 'ios', requested: 300, expected: 300_000 },
    { platform: 'android', requested: 900, expected: 900_000 },
  ])('preserves a slower requested interval on $platform', ({ platform, requested, expected }) => {
    const policy = getReminderPolicy(platform)
    const slower = { ...task, preference: { ...task.preference, intervalSeconds: requested } }
    const planned = planReminders([slower], { now, settings, ...policy.planning })
    expect(planned[1].at - now).toBe(expected)
  })
})
