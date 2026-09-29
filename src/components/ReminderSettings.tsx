'use client'

import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { useAuth } from '@/hooks/useAuth'
import { DEFAULT_REMINDER_SETTINGS, getReminderSettings, setReminderSettings, type ReminderSettings as Settings, REMINDER_PREFERENCES_EVENT } from '@/lib/reminders/preferences'
import { getReminderStatus, REMINDER_STATUS_EVENT, requestReminderPermission, scheduleReminderProbe, cancelTaskNativeReminders } from '@/lib/reminders/native'
import { getReminderPolicy } from '@/lib/reminders/policy'
import { toast } from 'sonner'

export function ReminderSettings() {
  const { user } = useAuth()
  const [settings, setSettings] = useState(DEFAULT_REMINDER_SETTINGS)
  const [status, setStatus] = useState('Checking this device…')
  const [policy, setPolicy] = useState(getReminderPolicy('web'))
  const native = policy.platform !== 'web'
  useEffect(() => {
    const refresh = () => { if (user) setSettings(getReminderSettings(user.id)); setStatus(getReminderStatus()); setPolicy(getReminderPolicy(Capacitor.getPlatform())) }
    refresh()
    window.addEventListener(REMINDER_STATUS_EVENT, refresh)
    window.addEventListener(REMINDER_PREFERENCES_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => { window.removeEventListener(REMINDER_STATUS_EVENT, refresh); window.removeEventListener(REMINDER_PREFERENCES_EVENT, refresh); window.removeEventListener('storage', refresh) }
  }, [user?.id])
  function save(update: Partial<Settings>) {
    if (!user) return
    try { setReminderSettings(user.id, update) } catch (error) { toast.error((error as Error).message) }
  }
  async function run(action: () => Promise<unknown>) { try { await action() } catch (error) { toast.error((error as Error).message) } }
  return <section className="bg-card border border-border rounded-lg p-4 space-y-4" aria-label="Reminder settings">
    <div><h2 className="font-medium">My reminders</h2><p className="text-xs text-muted-foreground mt-1">Settings for your account on this device. Repeating reminders start off.</p></div>
    <p role="status" className="text-sm text-muted-foreground leading-relaxed">{status}</p>
    <button onClick={() => void run(requestReminderPermission)} className="px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm">Enable device notifications</button>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.quietEnabled} onChange={e => save({ quietEnabled: e.target.checked })} />Quiet hours</label>
    {settings.quietEnabled && <div className="flex gap-4">
      <label className="text-xs flex-1">From<input aria-label="Quiet hours start" type="time" value={settings.quietStart} onChange={e => save({ quietStart: e.target.value })} className="block mt-1 w-full bg-accent p-2 rounded" /></label>
      <label className="text-xs flex-1">Until<input aria-label="Quiet hours end" type="time" value={settings.quietEnd} onChange={e => save({ quietEnd: e.target.value })} className="block mt-1 w-full bg-accent p-2 rounded" /></label>
    </div>}
    <p className="text-xs text-muted-foreground">Quiet hours follow this device’s local time. Reminders resume afterward without sending a backlog. Matching start and end times means no quiet period.</p>
    {!native && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.sound} onChange={e => save({ sound: e.target.checked })} />Allow browser notification sound</label>}
    {native && <div className="border-t border-border pt-3 space-y-2">
      <h3 className="text-sm font-medium">Test on this phone</h3>
      <p className="text-xs text-muted-foreground">{policy.probeDescription}</p>
      <div className="flex flex-wrap gap-2"><button onClick={() => void run(scheduleReminderProbe)} className="px-3 py-2 rounded-md bg-accent text-sm">Start background test</button><button onClick={() => void run(() => cancelTaskNativeReminders('device-probe'))} className="px-3 py-2 rounded-md bg-accent text-sm">Cancel test</button></div>
    </div>}
  </section>
}
