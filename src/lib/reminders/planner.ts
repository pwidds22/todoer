import type { TaskReminderPreference, ReminderSettings } from './preferences'
import { REMINDER_HORIZON_MS, REMINDER_QUEUE_LIMIT } from './policy'

export interface ReminderInput {
  id: string
  title: string
  due_date: string | null
  due_time: string | null
  is_completed: boolean | null
  is_deleted: boolean | null
  updated_at?: string | null
  preference: TaskReminderPreference
}
export interface PlannedReminder { id: number; taskId: string; title: string; at: number; revision: string; oneShot?: boolean }
type QuietSettings = Pick<ReminderSettings, 'quietEnabled' | 'quietStart' | 'quietEnd'>
export interface PlanOptions {
  now: number
  settings: QuietSettings
  limit?: number
  horizonMs?: number
  minimumIntervalSeconds?: number
  focus?: { taskId: string; until: number } | null
  consumedIds?: ReadonlySet<number>
}
const timeMinutes = (time: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) : null
export function isQuietTime(date: Date, settings: QuietSettings): boolean {
  if (!settings.quietEnabled) return false
  const start = timeMinutes(settings.quietStart), end = timeMinutes(settings.quietEnd)
  if (start === null || end === null || start === end) return false
  const minutes = date.getHours() * 60 + date.getMinutes()
  return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end
}
function afterQuiet(at: number, settings: QuietSettings): number {
  const date = new Date(at)
  if (!isQuietTime(date, settings)) return at
  const end = timeMinutes(settings.quietEnd)!
  const wake = new Date(at)
  wake.setHours(Math.floor(end / 60), end % 60, 0, 0)
  if (wake.getTime() <= at) wake.setDate(wake.getDate() + 1)
  return wake.getTime()
}
function notificationId(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619)
  return (hash >>> 0) % 2000000000 + 1
}
export function reminderRevision(task: ReminderInput): string {
  // Title edits must replace notification text, but unrelated updated_at/last_nag writes must not reset cadence.
  return JSON.stringify([task.id, task.title, task.due_date, task.due_time, task.preference.mode, task.preference.intervalSeconds, task.preference.snoozeUntil])
}
export function planReminders(tasks: ReminderInput[], options: PlanOptions): PlannedReminder[] {
  const { now, settings, focus } = options
  const limit = Math.max(0, Math.min(options.limit ?? REMINDER_QUEUE_LIMIT, REMINDER_QUEUE_LIMIT))
  const horizon = now + (options.horizonMs ?? REMINDER_HORIZON_MS)
  const result: PlannedReminder[] = []
  for (const task of tasks) {
    if (!task.preference.enabled || task.is_completed || task.is_deleted || !task.due_date || !task.due_time) continue
    const due = new Date(`${task.due_date}T${task.due_time}`).getTime()
    if (!Number.isFinite(due)) continue
    const requested = task.preference.intervalSeconds
    const interval = Math.max(Number.isFinite(requested) ? requested : 60, options.minimumIntervalSeconds ?? 60, 60) * 1000
    const snooze = task.preference.snoozeUntil ? Date.parse(task.preference.snoozeUntil) : 0
    const base = Math.max(due, Number.isFinite(snooze) ? snooze : 0, focus?.taskId === task.id ? focus.until : 0)
    const revision = reminderRevision(task)
    let slot = task.preference.mode !== 'once' && base < now ? Math.floor((now - base) / interval) : 0
    for (let n = 0; n < limit; n++, slot++) {
      let at = afterQuiet(Math.max(now + 1000, base + slot * interval), settings)
      if (at > horizon) break
      // Keep a slot's identity stable while its delivery is pending in foreground.
      const id = notificationId(task.preference.mode === 'once' ? `${revision}:once` : `${revision}:${base + slot * interval}`)
      if (!options.consumedIds?.has(id)) result.push({ id, taskId: task.id, title: task.title, at, revision, oneShot: task.preference.mode === 'once' })
      if (task.preference.mode === 'once') break
      if (at > base + slot * interval + 1000) slot = Math.floor((at - base) / interval)
    }
  }
  const ids = new Set<number>()
  return result.sort((a, b) => a.at - b.at || a.taskId.localeCompare(b.taskId)).filter(item => {
    // Guard even rare hash collisions: never assign two pending reminders the same native ID.
    while (ids.has(item.id)) item.id = item.id % 2000000000 + 1
    ids.add(item.id)
    return true
  }).slice(0, limit)
}
