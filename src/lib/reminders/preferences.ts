export interface TaskReminderPreference {
  enabled: boolean
  mode?: 'once' | 'persistent'
  intervalSeconds: number
  snoozeUntil?: string | null
}

export interface ReminderSettings {
  quietEnabled: boolean
  quietStart: string
  quietEnd: string
  sound: boolean
}

export const REMINDER_INTERVALS = [60, 120, 300, 600, 900, 1800, 3600]
export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = { quietEnabled: true, quietStart: '22:00', quietEnd: '07:00', sound: false }
export const REMINDER_PREFERENCES_EVENT = 'todoer:reminders-changed'
const OFF: TaskReminderPreference = { enabled: false, mode: 'persistent', intervalSeconds: 60 }
const key = (userId: string) => `todoer-reminders-v1:${userId}`

interface Preferences { tasks: Record<string, TaskReminderPreference>; settings: ReminderSettings }
function read(userId: string): Preferences {
  try {
    const raw = JSON.parse(localStorage.getItem(key(userId)) || '{}')
    return { tasks: raw.tasks && typeof raw.tasks === 'object' ? raw.tasks : {}, settings: { ...DEFAULT_REMINDER_SETTINGS, ...raw.settings } }
  } catch { return { tasks: {}, settings: DEFAULT_REMINDER_SETTINGS } }
}
function write(userId: string, value: Preferences) {
  if (!userId) throw new Error('Sign in before setting a reminder.')
  try { localStorage.setItem(key(userId), JSON.stringify(value)) }
  catch { throw new Error('This device could not save your reminder settings. Check available storage and try again.') }
  window.dispatchEvent(new Event(REMINDER_PREFERENCES_EVENT))
}
export function getTaskReminderPreference(userId: string, taskId: string): TaskReminderPreference {
  const pref = read(userId).tasks[taskId]
  if (!pref || pref.enabled !== true) return { ...OFF }
  return { ...pref, enabled: true, mode: pref.mode === 'once' ? 'once' : 'persistent', intervalSeconds: REMINDER_INTERVALS.includes(pref.intervalSeconds) ? pref.intervalSeconds : 60 }
}
export function setTaskReminderPreference(userId: string, taskId: string, preference: TaskReminderPreference) {
  const current = read(userId)
  current.tasks[taskId] = preference
  write(userId, current)
}
export function getReminderSettings(userId: string): ReminderSettings { return read(userId).settings }
export function setReminderSettings(userId: string, settings: Partial<ReminderSettings>) {
  const current = read(userId)
  current.settings = { ...current.settings, ...settings }
  write(userId, current)
}
