'use client'

import { useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useCompleteTask } from '@/hooks/useTasks'
import { useUIStore } from '@/stores/ui-store'
import { toast } from 'sonner'
import type { Task } from '@/types/database'
import { planReminders, reminderRevision, isQuietTime, type PlannedReminder } from '@/lib/reminders/planner'
import { getReminderSettings, getTaskReminderPreference, setTaskReminderPreference, REMINDER_PREFERENCES_EVENT } from '@/lib/reminders/preferences'
import { activateReminderAccount, cancelTaskNativeReminders, listenForReminderActions, syncNativeReminders, reportReminderStatus } from '@/lib/reminders/native'
import { readFocusSuppression } from '@/lib/focus-timer'
import { isNative } from '@/lib/native/platform'
import { readReminderReceipts } from '@/lib/reminders/receipts'
import { getReminderPolicy } from '@/lib/reminders/policy'

/** Foreground delivery + finite native scheduling. There is no background JS timer claim. */
export function NagReminder() {
  const { user } = useAuth()
  const complete = useCompleteTask()
  const completeRef = useRef(complete)
  completeRef.current = complete
  useEffect(() => {
    if (!user) return
    const userId = user.id
    activateReminderAccount(userId)
    const supabase = createClient()
    let disposed = false
    let fetchVersion = 0
    let tasks: Task[] = []
    let fetchedAt = 0
    let plan: PlannedReminder[] = []
    let nativeSyncVersion = 0
    let nativeSyncPending = false
    let nativeOwnedOneShotIds = new Set<number>()
    const pending = new Map<string, number>()
    const dirty = new Set<string>()
    const notifications = new Map<string, Notification>()
    const receiptsKey = `todoer-foreground-receipts:${userId}`
    let receipts: Record<string, number> = {}
    let onceIds: Record<string, boolean> = {}
    try { const stored = readReminderReceipts(localStorage.getItem(receiptsKey)); receipts = stored.issued; onceIds = stored.onceIds } catch { /* empty receipt ledger */ }
    function closeTask(taskId: string) {
      toast.dismiss(`reminder-${taskId}`)
      notifications.get(taskId)?.close()
      notifications.delete(taskId)
    }
    function snooze(taskId: string) {
      const preference = getTaskReminderPreference(userId, taskId)
      try {
        setTaskReminderPreference(userId, taskId, { ...preference, snoozeUntil: new Date(Date.now() + 600000).toISOString() })
        closeTask(taskId)
      } catch (error) { toast.error((error as Error).message) }
    }
    function rebuild() {
      if (disposed) return
      const now = Date.now()
      const settings = getReminderSettings(userId)
      const inputs = tasks.filter(t => !dirty.has(t.id)).map(task => ({ ...task, preference: getTaskReminderPreference(userId, task.id) }))
      const focus = readFocusSuppression(userId, now)
      plan = planReminders(inputs, { now, settings, focus, consumedIds: new Set(Object.keys(receipts).map(Number)) })
      for (const task of tasks) {
        const preference = getTaskReminderPreference(userId, task.id)
        if (!preference.enabled || dirty.has(task.id) || focus?.taskId === task.id || isQuietTime(new Date(now), settings) || Date.parse(preference.snoozeUntil || '') > now || new Date(`${task.due_date}T${task.due_time}`).getTime() > now) closeTask(task.id)
      }
      // Background shared-list reminders need server-side personal subscriptions
      // and stale-state handling. Stage 1 schedules only the user's Inbox tasks.
      const privateInputs = inputs.filter(t => t.user_id === userId && !t.project_id)
      const syncVersion = ++nativeSyncVersion
      nativeSyncPending = isNative()
      const policy = getReminderPolicy(Capacitor.getPlatform())
      void syncNativeReminders(userId, consumedIds => planReminders(privateInputs, { now, settings, focus, ...policy.planning, consumedIds }), privateInputs.filter(t => t.preference.enabled).map(reminderRevision)).then(result => {
        if (disposed || syncVersion !== nativeSyncVersion) return
        nativeOwnedOneShotIds = new Set(result.ownedOneShotIds)
        nativeSyncPending = false
      }).catch(() => {
        // Ownership is uncertain after a device error. Retry the native sync before
        // allowing an Inbox one-shot to fall back and possibly fire a second time.
        if (!disposed && syncVersion === nativeSyncVersion) toast.error('Could not update device reminders. Check Settings for status.', { id: 'reminder-error' })
      })
      for (const id of Object.keys(receipts)) if (!onceIds[id] && receipts[id] < now - 86400000) delete receipts[id]
    }
    async function refresh() {
      const version = ++fetchVersion
      const { data, error } = await supabase.from('tasks').select('*').eq('is_completed', false).eq('is_deleted', false)
      if (disposed || version !== fetchVersion) return
      if (error) {
        reportReminderStatus('Could not refresh tasks. Shared-list alerts are paused; existing Inbox device alerts may continue until their queue ends.')
        return
      }
      const previous = tasks
      tasks = (data ?? []) as Task[]
      for (const id of dirty) if (!pending.has(id)) dirty.delete(id)
      fetchedAt = Date.now()
      for (const task of previous) if (!tasks.some(t => t.id === task.id)) closeTask(task.id)
      rebuild()
    }
    function changed() { rebuild(); void refresh() }
    function mutation(event: Event) {
      const { id, phase } = (event as CustomEvent<{ id: string; phase: string }>).detail
      ++fetchVersion
      closeTask(id)
      if (phase === 'start') {
        pending.set(id, (pending.get(id) || 0) + 1)
        dirty.add(id)
        plan = plan.filter(n => n.taskId !== id)
        void cancelTaskNativeReminders(id).catch(() => toast.error('Could not cancel device reminders. Try again.'))
      } else {
        const count = (pending.get(id) || 1) - 1
        if (count > 0) pending.set(id, count); else pending.delete(id)
        void refresh()
      }
    }
    function tick() {
      if (disposed || document.visibilityState !== 'visible') return
      const now = Date.now()
      const newestDue = new Map<string, PlannedReminder>()
      for (const reminder of plan) if (reminder.at <= now && !receipts[reminder.id]) newestDue.set(reminder.taskId, reminder)
      for (const reminder of newestDue.values()) {
        if (reminder.at > now || receipts[reminder.id]) continue
        const task = tasks.find(t => t.id === reminder.taskId)
        if (!task || dirty.has(task.id) || isQuietTime(new Date(now), getReminderSettings(userId))) continue
        if (reminder.oneShot && isNative() && task.user_id === userId && !task.project_id
          && (nativeSyncPending || nativeOwnedOneShotIds.has(reminder.id))) continue
        if ((task.project_id || task.user_id !== userId) && now - fetchedAt > 20000) continue
        for (const previous of plan) if (previous.taskId === task.id && previous.at <= now) receipts[previous.id] = now
        if (getTaskReminderPreference(userId, task.id).mode === 'once') onceIds[reminder.id] = true
        try { localStorage.setItem(receiptsKey, JSON.stringify({ receipts, onceIds })) } catch { /* deduplication still works this session */ }
        const open = () => useUIStore.getState().selectTask(task.id)
        toast(task.title, {
          id: `reminder-${task.id}`, duration: Infinity,
          description: <span>Ready now, or choose a better time. <button type="button" onClick={open} className="font-medium underline underline-offset-2">Reschedule</button></span>,
          action: { label: 'Done', onClick: () => completeRef.current.mutate({ id: task.id, isCompleted: true }) },
          cancel: { label: 'Snooze 10 min', onClick: () => snooze(task.id) },
        })
        if (!isNative() && 'Notification' in window && Notification.permission === 'granted') {
          try {
            notifications.get(task.id)?.close()
            const notification = new Notification(task.title, { body: 'Open for Done, Snooze or Reschedule.', tag: `todoer-${task.id}`, silent: !getReminderSettings(userId).sound })
            notification.onclick = () => { window.focus(); open(); notification.close() }
            notifications.set(task.id, notification)
          } catch { /* in-app actions work where browser Notification is unsupported */ }
        }
      }
    }
    const actions = listenForReminderActions((taskId, action) => {
      if (disposed || taskId === 'device-probe') return
      useUIStore.getState().selectTask(taskId)
      if (action === 'done') completeRef.current.mutate({ id: taskId, isCompleted: true })
      if (action === 'snooze') snooze(taskId)
    })
    function stop() { disposed = true; ++nativeSyncVersion; plan = []; notifications.forEach(n => n.close()); tasks.forEach(t => closeTask(t.id)) }
    function resume() { disposed = false; activateReminderAccount(userId); void refresh() }
    void actions.catch(() => reportReminderStatus('Notification actions could not be initialized. Reopen Todoer.'))
    void refresh()
    const poll = setInterval(() => void refresh(), 15000)
    const clock = setInterval(tick, 1000)
    window.addEventListener('focus', changed)
    window.addEventListener('online', changed)
    window.addEventListener('storage', changed)
    window.addEventListener(REMINDER_PREFERENCES_EVENT, changed)
    window.addEventListener('todoer:focus-changed', changed)
    window.addEventListener('todoer:tasks-changed', changed)
    window.addEventListener('todoer:task-mutation', mutation)
    window.addEventListener('todoer:reminders-stopped', stop)
    window.addEventListener('todoer:reminders-resumed', resume)
    document.addEventListener('visibilitychange', changed)
    return () => {
      disposed = true
      ++fetchVersion
      clearInterval(poll); clearInterval(clock)
      notifications.forEach(n => n.close())
      tasks.forEach(t => closeTask(t.id))
      void actions.then(handle => handle.remove()).catch(() => {})
      window.removeEventListener('focus', changed)
      window.removeEventListener('online', changed)
      window.removeEventListener('storage', changed)
      window.removeEventListener(REMINDER_PREFERENCES_EVENT, changed)
      window.removeEventListener('todoer:focus-changed', changed)
      window.removeEventListener('todoer:tasks-changed', changed)
      window.removeEventListener('todoer:task-mutation', mutation)
      window.removeEventListener('todoer:reminders-stopped', stop)
      window.removeEventListener('todoer:reminders-resumed', resume)
      document.removeEventListener('visibilitychange', changed)
      // Device schedules survive termination; explicit sign-out cancels them.
    }
  }, [user?.id])
  return null
}
