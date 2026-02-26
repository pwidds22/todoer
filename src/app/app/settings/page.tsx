'use client'

import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings, Moon, Sun, Bell, Clock, Monitor, BellRing, Shield, Users, UserPlus, Mail, Check, X, Trash2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui-store'
import { useEffect, useState } from 'react'
import {
  useMyShares,
  usePendingInvitations,
  useSharedWithMe,
  useInviteUser,
  useAcceptInvitation,
  useDeclineInvitation,
  useRemoveShare,
} from '@/hooks/useSharing'

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

        {/* Sharing */}
        <SharingSection userEmail={user?.email || ''} />

        {/* Account */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="font-medium mb-3">Account</h2>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
      </div>
    </div>
  )
}

function SharingSection({ userEmail }: { userEmail: string }) {
  const { data: myShares, isLoading: loadingShares } = useMyShares()
  const { data: invitations, isLoading: loadingInvitations } = usePendingInvitations()
  const { data: sharedWithMe } = useSharedWithMe()
  const inviteUser = useInviteUser()
  const acceptInvitation = useAcceptInvitation()
  const declineInvitation = useDeclineInvitation()
  const removeShare = useRemoveShare()
  const [inviteEmail, setInviteEmail] = useState('')
  const [error, setError] = useState('')

  function handleInvite() {
    const email = inviteEmail.trim().toLowerCase()
    if (!email) return
    if (email === userEmail.toLowerCase()) {
      setError("You can't invite yourself")
      return
    }
    if (myShares?.some(s => s.shared_with_email === email)) {
      setError('Already invited this person')
      return
    }

    setError('')
    inviteUser.mutate(email, {
      onSuccess: () => setInviteEmail(''),
      onError: (err: any) => setError(err.message || 'Failed to send invitation'),
    })
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <h2 className="font-medium flex items-center gap-2 mb-3">
        <Users className="h-4 w-4" /> Sharing
      </h2>
      <p className="text-xs text-muted-foreground mb-4">
        Share your account with family members so they can view and manage your tasks, projects, and habits together.
      </p>

      {/* Pending invitations for me */}
      {invitations && invitations.length > 0 && (
        <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <p className="text-sm font-medium flex items-center gap-2 mb-2">
            <Mail className="h-3.5 w-3.5 text-primary" />
            Pending invitations
          </p>
          <div className="space-y-2">
            {invitations.map(inv => (
              <div key={inv.id} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Invitation from <strong className="text-foreground">{inv.shared_with_email === userEmail.toLowerCase() ? 'someone' : ''}</strong> (owner)
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => acceptInvitation.mutate(inv.id)}
                    disabled={acceptInvitation.isPending}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors disabled:opacity-50"
                  >
                    <Check className="h-3 w-3" /> Accept
                  </button>
                  <button
                    onClick={() => declineInvitation.mutate(inv.id)}
                    disabled={declineInvitation.isPending}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs bg-accent rounded-md hover:bg-accent/80 transition-colors disabled:opacity-50"
                  >
                    <X className="h-3 w-3" /> Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite form */}
      <div className="mb-4">
        <label className="text-sm font-medium mb-1 block">Invite someone</label>
        <div className="flex gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={e => { setInviteEmail(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleInvite()}
            placeholder="Enter email address..."
            className="flex-1 bg-accent rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button
            onClick={handleInvite}
            disabled={!inviteEmail.trim() || inviteUser.isPending}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {inviteUser.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <UserPlus className="h-3.5 w-3.5" />
            )}
            Invite
          </button>
        </div>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>

      {/* My shares list */}
      {loadingShares ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...
        </div>
      ) : myShares && myShares.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">People I invited</p>
          {myShares.map(share => (
            <div key={share.id} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                  {share.shared_with_email[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm">{share.shared_with_email}</p>
                  <p className={cn(
                    'text-xs',
                    share.status === 'accepted' ? 'text-green-500' : share.status === 'declined' ? 'text-red-400' : 'text-muted-foreground'
                  )}>
                    {share.status === 'accepted' ? 'Connected' : share.status === 'declined' ? 'Declined' : 'Pending...'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => removeShare.mutate(share.id)}
                disabled={removeShare.isPending}
                className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded transition-colors disabled:opacity-50"
                title="Remove"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {/* Shared with me list */}
      {sharedWithMe && sharedWithMe.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Shared with me</p>
          {sharedWithMe.map(share => (
            <div key={share.id} className="flex items-center gap-2 py-1.5">
              <div className="w-7 h-7 rounded-full bg-green-500/10 flex items-center justify-center text-xs font-medium text-green-500">
                <Check className="h-3.5 w-3.5" />
              </div>
              <div>
                <p className="text-sm">Shared by account owner</p>
                <p className="text-xs text-green-500">Connected</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loadingShares && (!myShares || myShares.length === 0) && (!sharedWithMe || sharedWithMe.length === 0) && (!invitations || invitations.length === 0) && (
        <p className="text-xs text-muted-foreground py-1">
          No active shares. Invite someone above to share your tasks and projects.
        </p>
      )}
    </div>
  )
}
