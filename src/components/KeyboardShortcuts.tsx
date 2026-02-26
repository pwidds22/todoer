'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUIStore } from '@/stores/ui-store'

export function KeyboardShortcuts() {
  const router = useRouter()
  const { setSidebarOpen, setQuickAddOpen, selectTask } = useUIStore()

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      // Don't intercept shortcuts when typing in inputs (except Escape)
      if (isInput && e.key !== 'Escape') return

      // Escape: close task detail
      if (e.key === 'Escape') {
        selectTask(null)
        return
      }

      // / or Cmd+K: go to search
      if (e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault()
        router.push('/app/search')
        return
      }

      // g then i: go to inbox (vim-style)
      // For simplicity, use single keys:
      // i = inbox, t = today, u = upcoming
      if (e.key === 'i' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        router.push('/app/inbox')
        return
      }

      if (e.key === 't' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        router.push('/app/today')
        return
      }

      if (e.key === 'u' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        router.push('/app/upcoming')
        return
      }

      if (e.key === 'c' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        router.push('/app/calendar')
        return
      }

      if (e.key === 'h' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        router.push('/app/habits')
        return
      }

      // m = toggle sidebar on mobile
      if (e.key === 'm' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setSidebarOpen(true)
        return
      }

      // ? = show keyboard shortcuts help
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // Could show a modal, for now just navigate to a helpful spot
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [router, setSidebarOpen, selectTask, setQuickAddOpen])

  return null
}
