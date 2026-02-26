'use client'

import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings, Moon, Sun, Bell, Clock, Monitor, BellRing, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui-store'
import { useEffect, useState } from 'react'

export default function SettingsPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { theme, setTheme } = useUIStore()
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default')

  useEffect(() => {
    if ('Notification' in window) {
      setNotifPermission(Notification.permission)
    }
  }, [])

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('dark', 'light')
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.add(prefersDark ? 'dark' : 'light')
    } else {
      root.classList.add(theme)
    }
  }, [theme])

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', user!.id).single()
      return data as { id: string; display_name: string | null; settings: any; timezone: string | null } | null
    },
    enabled: !!user,
  })

  const settings = (profile?.settings as any) || {}

  const updateSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const newSettings = { ...settings, [key]: value }
      await (supabase.from('profiles') as any).update({ settings: newSettings }).eq('id', user!.id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  })

  async function requestNotificationPermission() {
    if ('Notification' in window) {
      const result = await Notification.requestPermission()
      setNotifPermission(result)
    }
  }

  const themeOptions = [
    { value: 'light', label: 'Light', icon: <Sun className="h-4 w-4" /> },
    { value: 'dark', label: 'Dark', icon: <Moon className="h-4 w-4" /> },
    { value: 'system', label: 'System', icon: <Monitor className="h-4 w-4" /> },
  ] as const

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>
      </div>

      <div className="space-y-6">
        {/* Theme */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="font-medium flex items-center gap-2 mb-3">
            <Moon className="h-4 w-4" /> Appearance
          </h2>
          <div className="flex gap-2">
            {themeOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-md text-sm capitalize transition-colors',
                  theme === opt.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-accent hover:bg-accent/80'
                )}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="font-medium flex items-center gap-2 mb-3">
            <Bell className="h-4 w-4" /> Notifications
          </h2>
          <div className="space-y-4">
            {/* Permission status */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5" />
                  Browser notifications
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {notifPermission === 'granted'
                    ? 'Notifications are enabled'
                    : notifPermission === 'denied'
                    ? 'Notifications are blocked. Please enable them in browser settings.'
                    : 'Enable to receive nag reminders'}
                </p>
              </div>
              {notifPermission !== 'granted' && notifPermission !== 'denied' && (
                <button
                  onClick={requestNotificationPermission}
                  className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  Enable
                </button>
              )}
              {notifPermission === 'granted' && (
                <span className="text-xs text-green-500 flex items-center gap-1">
                  <BellRing className="h-3.5 w-3.5" /> Active
                </span>
              )}
            </div>

            <div className="h-px bg-border" />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">Default nag for new tasks</p>
                <p className="text-xs text-muted-foreground">Auto-enable nagging for tasks with a due time</p>
              </div>
              <button
                onClick={() => updateSetting.mutate({ key: 'default_nag', value: !settings.default_nag })}
                className={cn(
                  'w-10 h-5 rounded-full transition-colors relative',
                  settings.default_nag ? 'bg-orange-500' : 'bg-border'
                )}
              >
                <div className={cn(
                  'w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform',
                  settings.default_nag ? 'translate-x-5' : 'translate-x-0.5'
                )} />
              </button>
            </div>

            <div>
              <label className="text-sm">Default nag interval</label>
              <select
                value={settings.default_nag_interval || 60}
                onChange={(e) => updateSetting.mutate({ key: 'default_nag_interval', value: parseInt(e.target.value) })}
                className="w-full mt-1 text-sm bg-accent rounded-md px-3 py-2 focus:outline-none"
              >
                <option value={30}>Every 30 seconds</option>
                <option value={60}>Every 1 minute</option>
                <option value={120}>Every 2 minutes</option>
                <option value={300}>Every 5 minutes</option>
                <option value={600}>Every 10 minutes</option>
              </select>
            </div>
          </div>
        </div>

        {/* Time format */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="font-medium flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4" /> Date & Time
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm">Time format</label>
              <div className="flex gap-2 mt-1">
                {['12h', '24h'].map(fmt => (
                  <button
                    key={fmt}
                    onClick={() => updateSetting.mutate({ key: 'time_format', value: fmt })}
                    className={cn(
                      'px-4 py-2 rounded-md text-sm transition-colors',
                      settings.time_format === fmt
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-accent hover:bg-accent/80'
                    )}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm">Start of week</label>
              <div className="flex gap-2 mt-1">
                {[{ label: 'Sunday', value: 0 }, { label: 'Monday', value: 1 }].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => updateSetting.mutate({ key: 'start_of_week', value: opt.value })}
                    className={cn(
                      'px-4 py-2 rounded-md text-sm transition-colors',
                      settings.start_of_week === opt.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-accent hover:bg-accent/80'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Account */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="font-medium mb-3">Account</h2>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
      </div>
    </div>
  )
}
