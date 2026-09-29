import { expect, it } from 'vitest'
import { readReminderReceipts } from '@/lib/reminders/receipts'
import { planReminders } from '@/lib/reminders/planner'
import { REMINDER_QUEUE_LIMIT } from '@/lib/reminders/policy'

it.each(['null', '42', '[]', 'bad JSON', '{"issued":null,"onceIds":false}'])('recovers an invalid receipt ledger: %s', raw => {
  expect(readReminderReceipts(raw)).toEqual({ issued: {}, onceIds: {} })
})
it('accepts only valid IDs and finite timestamp values', () => {
  expect(readReminderReceipts('{"issued":{"1":123,"2":"abc"},"onceIds":{"1":true,"2":"true"}}')).toEqual({ issued: { '1': 123 }, onceIds: { '1': true } })
})
it('already delivered one-shot tasks do not starve later tasks outside a full queue', () => {
  const tasks = Array.from({ length: REMINDER_QUEUE_LIMIT + 8 }, (_, i) => ({ id: `task-${i}`, title: 'Task', due_date: '2026-09-12', due_time: '10:00', is_completed: false, is_deleted: false, preference: { enabled: true, mode: 'once' as const, intervalSeconds: 60 } }))
  const options = { now: new Date('2026-09-12T10:00:00').getTime(), settings: { quietEnabled: false, quietStart: '22:00', quietEnd: '07:00' } }
  const first = planReminders(tasks, options)
  expect(first).toHaveLength(REMINDER_QUEUE_LIMIT)
  const remaining = planReminders(tasks, { ...options, consumedIds: new Set(first.map(n => n.id)) })
  expect(remaining).toHaveLength(8)
  expect(remaining.every(n => !first.some(f => f.id === n.id))).toBe(true)
})
