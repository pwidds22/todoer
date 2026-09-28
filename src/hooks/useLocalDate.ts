'use client'

import { useEffect, useState } from 'react'
import { localDateKey } from '@/lib/dates'

/** Refresh an open list at local midnight, including after sleep or a timezone change. */
export function useLocalDate() {
  const [date, setDate] = useState(() => localDateKey())
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const refresh = () => {
      clearTimeout(timer)
      const now = new Date()
      setDate(localDateKey(now))
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      timer = setTimeout(refresh, Math.max(1000, tomorrow.getTime() - now.getTime() + 50))
    }
    refresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])
  return date
}
