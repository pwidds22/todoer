import { describe, expect, it } from 'vitest'
import { reconcileNotifications, type NotificationAdapter } from '../src/lib/reminders/reconcile'
import type { PlannedReminder } from '../src/lib/reminders/planner'

const a: PlannedReminder = { id: 1, taskId: 'a', title: 'Dentist', at: 10000, revision: 'v1' }
const b: PlannedReminder = { ...a, id: 2, at: 20000, revision: 'v2' }
function fake(initial: PlannedReminder[]) {
  let pending = [...initial]
  let delivered = [...initial]
  const calls: string[] = []
  const adapter: NotificationAdapter = {
    pending: async () => pending,
    delivered: async () => delivered,
    cancel: async ids => { calls.push('cancel'); pending = pending.filter(n => !ids.includes(n.id)) },
    removeDelivered: async ids => { calls.push('remove'); delivered = delivered.filter(n => !ids.includes(n.id)) },
    schedule: async reminders => { calls.push('schedule'); pending.push(...reminders) },
  }
  return { adapter, calls, read: () => ({ pending, delivered }) }
}
describe('native notification reconciliation', () => {
  it('replaces an existing slot if quiet hours move its future delivery time', async () => {
    const f = fake([a])
    const moved = { ...a, at: 20000 }
    await reconcileNotifications(f.adapter, [moved], { '1': a.at }, 0)
    expect(f.read().pending).toEqual([moved])
    expect(f.calls).toEqual(['cancel', 'schedule'])
  })
  it('cancels obsolete reminders before scheduling a new revision', async () => {
    const f = fake([a])
    await reconcileNotifications(f.adapter, [b], {}, 0)
    expect(f.calls).toEqual(['cancel', 'remove', 'schedule'])
    expect(f.read().pending).toEqual([b])
  })
  it('completion/deletion cancels pending and visible reminders', async () => {
    const f = fake([a, b])
    await reconcileNotifications(f.adapter, [], {}, 0)
    expect(f.read()).toEqual({ pending: [], delivered: [] })
  })
  it('reconciliation does not duplicate an existing schedule', async () => {
    const f = fake([a])
    await reconcileNotifications(f.adapter, [a], {}, 0)
    await reconcileNotifications(f.adapter, [a], {}, 0)
    expect(f.read().pending).toHaveLength(1)
    expect(f.calls).toEqual([])
  })
  it('does not reissue a reminder that was already delivered before reopening', async () => {
    const f = fake([])
    await reconcileNotifications(f.adapter, [{ ...a, at: 30000 }], { '1': 10000 }, 20000)
    expect(f.read().pending).toEqual([])
  })
  it('a cancellation failure prevents stale and replacement plans running together', async () => {
    const f = fake([a])
    f.adapter.cancel = async () => { throw new Error('device busy') }
    await expect(reconcileNotifications(f.adapter, [b], {}, 0)).rejects.toThrow('device busy')
    expect(f.calls).not.toContain('schedule')
  })
})
