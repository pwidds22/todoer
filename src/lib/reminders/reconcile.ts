import type { PlannedReminder } from './planner'

export interface NotificationAdapter {
  pending(): Promise<PlannedReminder[]>
  delivered(): Promise<PlannedReminder[]>
  cancel(ids: number[]): Promise<void>
  removeDelivered(ids: number[]): Promise<void>
  schedule(reminders: PlannedReminder[]): Promise<void>
}

/** Cancel first. An error is propagated: a failed schedule is never reported as saved. */
export async function reconcileNotifications(adapter: NotificationAdapter, desired: PlannedReminder[], issued: Record<string, number>, now: number, retainRevisions?: ReadonlySet<string>) {
  const pending = await adapter.pending()
  const wanted = new Set(desired.map(n => n.id))
  const moved = new Set(pending.filter(n => desired.some(d => d.id === n.id && d.at !== n.at && d.at > now + 1000)).map(n => n.id))
  const obsolete = pending.filter(n => !wanted.has(n.id) || moved.has(n.id))
  if (obsolete.length) await adapter.cancel(obsolete.map(n => n.id))
  const delivered = await adapter.delivered()
  const obsoleteDelivered = delivered.filter(n => !retainRevisions?.has(n.revision) && !desired.some(d => d.taskId === n.taskId && d.revision === n.revision))
  if (obsoleteDelivered.length) await adapter.removeDelivered(obsoleteDelivered.map(n => n.id))
  for (const id of moved) delete issued[id]
  const existing = new Set(pending.filter(n => !moved.has(n.id)).map(n => n.id))
  const fresh = desired.filter(n => !existing.has(n.id) && !(issued[n.id] !== undefined && issued[n.id] <= now))
  if (fresh.length) {
    await adapter.schedule(fresh)
    for (const reminder of fresh) issued[reminder.id] = reminder.at
  }
}
