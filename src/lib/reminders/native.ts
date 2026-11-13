import { isNative } from '@/lib/native/platform'
import { Capacitor } from '@capacitor/core'
import { reconcileNotifications, type NotificationAdapter } from './reconcile'
import { REMINDER_PAUSE_TASK_ID, type PlannedReminder } from './planner'
import { readReminderReceipts } from './receipts'
import { getNativeReminderStatus, getReminderPolicy } from './policy'

const SOURCE = 'todoer-local-v1'
export const REMINDER_STATUS_EVENT = 'todoer:reminder-status'
let queue = Promise.resolve()
let activeAccount: string | null = null
let generation = 0
export function activateReminderAccount(userId: string) { activeAccount = userId; generation++ }
export function stopReminderAccount() {
  activeAccount = null
  generation++
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('todoer:reminders-stopped'))
}
let status: string | null = null
export function getReminderStatus() { return status ?? getReminderPolicy(Capacitor.getPlatform()).initialStatus }
export function reportReminderStatus(message: string) {
  status = message
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(REMINDER_STATUS_EVENT))
}
function serial<T>(work: () => Promise<T>): Promise<T> {
  const result = queue.then(work)
  queue = result.then(() => {}, () => {})
  return result
}
async function api() { return (await import('@capacitor/local-notifications')).LocalNotifications }
async function adapter(includeProbe = false): Promise<NotificationAdapter> {
  const plugin = await api()
  // Capacitor 8.0.2 forwards this name to UNNotificationSound and documents
  // system fallback for missing files. Standard sound respects phone settings.
  const sound = Capacitor.getPlatform() === 'ios' ? 'default' : undefined
  const fromNative = (n: { id: number; title?: string; extra?: Record<string, unknown> }): PlannedReminder => ({
    id: n.id, taskId: String(n.extra?.taskId ?? ''), title: n.title || '', at: Number(n.extra?.at || 0), revision: String(n.extra?.revision || ''),
  })
  return {
    pending: async () => (await plugin.getPending()).notifications.filter(n => n.extra?.source === SOURCE && (includeProbe || n.extra?.taskId !== 'device-probe')).map(fromNative),
    delivered: async () => (await plugin.getDeliveredNotifications()).notifications.filter(n => n.extra?.source === SOURCE && (includeProbe || n.extra?.taskId !== 'device-probe')).map(fromNative),
    cancel: async ids => { await plugin.cancel({ notifications: ids.map(id => ({ id })) }) },
    removeDelivered: async ids => {
      const delivered = (await plugin.getDeliveredNotifications()).notifications.filter(n => ids.includes(n.id))
      if (delivered.length) await plugin.removeDeliveredNotifications({ notifications: delivered })
    },
    schedule: async reminders => {
      await plugin.schedule({ notifications: reminders.map(n => ({
        id: n.id, title: n.title, body: n.body ?? 'Open Todoer to complete, snooze or reschedule.',
        channelId: 'todoer-reminders',
        // The pause notice is not a task, so it gets no Done/Snooze buttons.
        ...(n.taskId === REMINDER_PAUSE_TASK_ID ? {} : { actionTypeId: 'todoer-task' }),
        ...(sound ? { sound } : {}),
        schedule: { at: new Date(n.at), allowWhileIdle: true },
        extra: { source: SOURCE, taskId: n.taskId, revision: n.revision, at: n.at },
      })) })
    },
  }
}

/** Only confirmed cancellations release one-shot ownership; delivered receipts survive. */
async function cancelDeviceReminders(device: NotificationAdapter, userId: string | null, taskId?: string, releaseFutureAfter?: number) {
  const pending = (await device.pending()).filter(n => taskId === undefined || n.taskId === taskId)
  if (pending.length) await device.cancel(pending.map(n => n.id))
  // Check after cancellation, in case a pending alert reached delivery during the await.
  const delivered = (await device.delivered()).filter(n => taskId === undefined || n.taskId === taskId)
  const storageKey = userId ? `todoer-issued-v2:${userId}` : null
  const receipts = readReminderReceipts(storageKey ? localStorage.getItem(storageKey) : null)
  const canceledIds = new Set(pending.map(n => n.id))
  const deliveredIds = new Set(delivered.map(n => n.id))
  let changed = false
  for (const id of Object.keys(receipts.onceIds)) {
    const canceled = canceledIds.has(Number(id))
      || (releaseFutureAfter !== undefined && receipts.issued[id] > releaseFutureAfter)
    if (canceled && !deliveredIds.has(Number(id))) {
      delete receipts.issued[id]
      delete receipts.onceIds[id]
      changed = true
    }
  }
  if (storageKey && changed) localStorage.setItem(storageKey, JSON.stringify(receipts))
  if (delivered.length) await device.removeDelivered(delivered.map(n => n.id))
  return receipts
}

export async function requestReminderPermission(): Promise<string> {
  if (isNative()) {
    const plugin = await api()
    const permission = await plugin.requestPermissions()
    if (permission.display !== 'granted') { reportReminderStatus('Notifications are blocked. Enable them in your phone settings.'); return permission.display }
    if (Capacitor.getPlatform() === 'android') {
      await plugin.createChannel({ id: 'todoer-reminders', name: 'Task reminders', description: 'Reminders you enabled on this device', importance: 4, visibility: 0, vibration: true })
    }
    reportReminderStatus('Permission granted. Save a timed Inbox task and enable its reminder to schedule it.')
    window.dispatchEvent(new Event('todoer:reminders-changed'))
    return permission.display
  }
  if (!('Notification' in window)) return 'unsupported'
  const permission = await Notification.requestPermission()
  reportReminderStatus(permission === 'granted' ? 'Browser notifications enabled. Keep Todoer open; background delivery is not supported.' : 'Browser notifications are blocked. In-app reminders still work while Todoer is open.')
  return permission
}
export interface NativeReminderSyncResult { ownedOneShotIds: number[] }

export function syncNativeReminders(userId: string, build: (consumed: ReadonlySet<number>) => PlannedReminder[], retainRevisions: string[] = []): Promise<NativeReminderSyncResult> {
  if (!isNative()) return Promise.resolve({ ownedOneShotIds: [] })
  const version = generation
  return serial(async () => {
    if (activeAccount !== userId || version !== generation) return { ownedOneShotIds: [] }
    const plugin = await api()
    const storageKey = `todoer-issued-v2:${userId}`
    const { issued, onceIds } = readReminderReceipts(localStorage.getItem(storageKey))
    const now = Date.now()
    const device = await adapter()
    const pendingIds = new Set((await device.pending()).map(n => n.id))
    if ((await plugin.checkPermissions()).display !== 'granted') {
      if (activeAccount !== userId || version !== generation) return { ownedOneShotIds: [] }
      reportReminderStatus('Notifications are not enabled. Enable them in Settings.')
      // Revoking permission can remove OS pending entries before we observe them.
      const remaining = await cancelDeviceReminders(device, userId, undefined, now)
      return { ownedOneShotIds: Object.keys(remaining.onceIds).filter(id => remaining.issued[id] !== undefined && remaining.issued[id] <= now).map(Number) }
    }
    const consumed = new Set(Object.keys(issued).filter(id => issued[id] <= now && !pendingIds.has(Number(id))).map(Number))
    const foreground = readReminderReceipts(localStorage.getItem(`todoer-foreground-receipts:${userId}`))
    for (const id of Object.keys(foreground.onceIds)) {
      if (foreground.issued[id] !== undefined && foreground.issued[id] <= now) consumed.add(Number(id))
    }
    const desired = build(consumed)
    for (const n of desired) if (n.oneShot) onceIds[n.id] = true
    for (const id of Object.keys(issued)) if (!onceIds[id] && issued[id] < now - 86400000) delete issued[id]
    if (activeAccount !== userId || version !== generation) return { ownedOneShotIds: [] }
    await reconcileNotifications(device, desired, issued, now, new Set(retainRevisions))
    localStorage.setItem(storageKey, JSON.stringify({ issued, onceIds }))
    const platform = Capacitor.getPlatform()
    const exact = platform === 'android' ? (await plugin.checkExactNotificationSetting()).exact_alarm === 'granted' : true
    reportReminderStatus(getNativeReminderStatus(platform, desired.length, exact))
    // Foreground delivery waits for this result, so one logical one-shot has one owner.
    return { ownedOneShotIds: Object.keys(onceIds).filter(id => issued[id] !== undefined || pendingIds.has(Number(id))).map(Number) }
  }).catch(error => {
    reportReminderStatus('Reminders could not be updated on this device. Reopen Todoer and try again.')
    throw error
  })
}
export function cancelTaskNativeReminders(taskId: string, userId: string | null = activeAccount) {
  if (!isNative()) return Promise.resolve()
  return serial(async () => {
    await cancelDeviceReminders(await adapter(true), userId, taskId)
  })
}
export function clearNativeReminders(userId: string | null = activeAccount) {
  if (!isNative()) return Promise.resolve()
  return serial(async () => { await cancelDeviceReminders(await adapter(true), userId, undefined, Date.now()) })
}
export async function listenForReminderActions(onAction: (taskId: string, action: string) => void) {
  if (!isNative()) return { remove: async () => {} }
  const plugin = await api()
  await plugin.registerActionTypes({ types: [{ id: 'todoer-task', actions: [
    { id: 'done', title: 'Done', foreground: true },
    { id: 'snooze', title: 'Snooze 10 min', foreground: true },
    { id: 'reschedule', title: 'Reschedule', foreground: true },
  ] }] })
  return plugin.addListener('localNotificationActionPerformed', event => {
    if (event.notification.extra?.source === SOURCE) onAction(String(event.notification.extra.taskId), event.actionId)
  })
}
/** A real-device probe independent of database availability. Never scheduled automatically. */
export async function scheduleReminderProbe() {
  if (!isNative()) throw new Error('The background reminder test requires the installed phone app.')
  const version = generation
  return serial(async () => {
    if (version !== generation || await requestReminderPermission() !== 'granted' || version !== generation) return
    const policy = getReminderPolicy(Capacitor.getPlatform())
    const device = await adapter(true)
    const start = Date.now()
    await device.schedule(policy.probeOffsetsMinutes.map((minutes, i) => ({
      id: 2100000000 + i, taskId: 'device-probe', title: `Todoer reminder test ${i + 1}/3`,
      at: start + minutes * 60000, revision: 'device-probe',
    })))
    reportReminderStatus(policy.probeScheduledStatus)
  })
}
