'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { clearNativeReminders, stopReminderAccount } from '@/lib/reminders/native'
import { toast } from 'sonner'

const AuthContext = createContext<{ user: User | null; loading: boolean; signOut: () => Promise<void> } | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()
  useEffect(() => {
    let active = true
    let authEventReceived = false
    let accountId: string | null = null
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      authEventReceived = true
      if (accountId && accountId !== (session?.user.id ?? null)) {
        stopReminderAccount()
        void clearNativeReminders(accountId).catch(() => toast.error('Could not clear this device’s reminders. Reopen Todoer to retry.'))
      }
      accountId = session?.user.id ?? null
      if (active) { setUser(session?.user ?? null); setLoading(false) }
    })
    // This reads the local session for UI only. Database authorization still uses RLS.
    supabase.auth.getSession().then(({ data }) => {
      if (active && !authEventReceived) { accountId = data.session?.user.id ?? null; setUser(data.session?.user ?? null); setLoading(false) }
    }).catch(() => { if (active) setLoading(false) })
    return () => { active = false; subscription.unsubscribe() }
  }, [supabase])

  async function signOut() {
    stopReminderAccount()
    try {
      await clearNativeReminders(user?.id ?? null)
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch {
      window.dispatchEvent(new Event('todoer:reminders-resumed'))
      toast.error('Could not finish signing out. Check your connection and try again.')
      return
    }
    setUser(null)
    router.push('/login')
  }
  return <AuthContext.Provider value={{ user, loading, signOut }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth requires AuthProvider')
  return value
}
