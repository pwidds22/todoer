'use client'

import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { useAuth } from '@/hooks/useAuth'
import { getTaskReminderPreference, setTaskReminderPreference, REMINDER_INTERVALS, REMINDER_PREFERENCES_EVENT, type TaskReminderPreference } from '@/lib/reminders/preferences'
import { cancelTaskNativeReminders } from '@/lib/reminders/native'
import { getReminderPolicy } from '@/lib/reminders/policy'
import type { Task } from '@/types/database'
import { toast } from 'sonner'

export function ReminderControls({ task }: { task: Task }) {
  const { user } = useAuth()
  const [preference, setPreference] = useState<TaskReminderPreference>({ enabled: false, mode: 'persistent', intervalSeconds: 60 })
  const [policy, setPolicy] = useState(getReminderPolicy('web'))
  useEffect(() => {
    function refresh() { if (user) setPreference(getTaskReminderPreference(user.id, task.id)); setPolicy(getReminderPolicy(Capacitor.getPlatform())) }
    refresh()
    window.addEventListener(REMINDER_PREFERENCES_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => { window.removeEventListener(REMINDER_PREFERENCES_EVENT, refresh); window.removeEventListener('storage', refresh) }
  }, [user?.id, task.id])
  async function save(update: Partial<TaskReminderPreference>) {
    if (!user) return
    try {
      await cancelTaskNativeReminders(task.id)
      setTaskReminderPreference(user.id, task.id, { ...preference, ...update })
    } catch (error) { toast.error((error as Error).message) }
  }
  const canRemind = !!task.due_date && !!task.due_time && !task.is_completed && !task.is_deleted
  const reminderSummary = !preference.enabled ? 'Reminders off' : preference.mode === 'once'
    ? 'Once at the due time'
    : `Every ${preference.intervalSeconds / 60} ${preference.intervalSeconds === 60 ? 'minute' : 'minutes'}`

  return (
    <section className="rounded-lg border border-border p-3 space-y-3" aria-label="My reminder">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{reminderSummary}</p>
        <button
          type="button"
          disabled={!preference.enabled || !canRemind}
          onClick={() => void save({ snoozeUntil: new Date(Date.now() + 600000).toISOString() })}
          className="shrink-0 text-sm px-3 py-2 rounded-md bg-accent disabled:opacity-50"
        >
          Snooze 10 minutes
        </button>
      </div>
      {preference.enabled && preference.snoozeUntil && Date.parse(preference.snoozeUntil) > Date.now() && (
        <p role="status" className="text-xs text-muted-foreground">Snoozed until {new Date(preference.snoozeUntil).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.</p>
      )}
      <details>
        <summary className="cursor-pointer text-xs font-medium">Reminder settings</summary>
        <div className="mt-3 space-y-3">
          <label htmlFor="task-reminder-mode" className="block text-xs">Remind me on this device</label>
          <select id="task-reminder-mode" className="w-full bg-accent rounded-md p-2 text-sm" value={preference.enabled ? preference.mode || 'persistent' : 'off'}
            disabled={!canRemind}
            onChange={e => void save({ enabled: e.target.value !== 'off', mode: e.target.value === 'once' ? 'once' : 'persistent', snoozeUntil: null })}>
            <option value="off">Off</option><option value="once">Once at the due time</option><option value="persistent">Repeat until I act</option>
          </select>
          {(!task.due_date || !task.due_time) && <p className="text-xs text-muted-foreground">Choose a date and time first.</p>}
          {preference.enabled && preference.mode !== 'once' && <label className="block text-xs">Requested interval
            <select disabled={!canRemind} className="block w-full bg-accent p-2 rounded-md text-sm mt-1" value={preference.intervalSeconds} onChange={e => void save({ intervalSeconds: Number(e.target.value) })}>
              {REMINDER_INTERVALS.map(seconds => <option key={seconds} value={seconds}>Every {seconds / 60} {seconds === 60 ? 'minute' : 'minutes'}</option>)}
            </select>
          </label>}
          <p className="text-xs text-muted-foreground leading-relaxed">{policy.controlsDescription}</p>
        </div>
      </details>
    </section>
  )
}
