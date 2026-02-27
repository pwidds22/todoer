'use client'

import { useEffect } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { useUIStore } from '@/stores/ui-store'
import { Menu } from 'lucide-react'
import { TaskDetail } from '@/components/tasks/TaskDetail'
import { NagReminder } from '@/components/NagReminder'
import { Toaster } from 'sonner'
import { KeyboardShortcuts } from '@/components/KeyboardShortcuts'
import { AuthGuard } from '@/components/AuthGuard'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { setSidebarOpen, taskDetailOpen, selectedTaskId, selectTask, theme } = useUIStore()

  // Apply theme class to <html> and persist
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('dark', 'light')
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.add(prefersDark ? 'dark' : 'light')

      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = (e: MediaQueryListEvent) => {
        root.classList.remove('dark', 'light')
        root.classList.add(e.matches ? 'dark' : 'light')
      }
      mediaQuery.addEventListener('change', handler)
      return () => mediaQuery.removeEventListener('change', handler)
    } else {
      root.classList.add(theme)
    }
  }, [theme])

  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden" style={{
          paddingTop: 'var(--safe-area-top)',
          paddingBottom: 'var(--safe-area-bottom)',
        }}>
        <Sidebar />

        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile header */}
          <div className="md:hidden flex items-center gap-2 p-3 border-b border-border">
            <button onClick={() => setSidebarOpen(true)} className="p-1 hover:bg-accent rounded">
              <Menu className="h-5 w-5" />
            </button>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </main>

        {/* Task detail slide-in panel */}
        {taskDetailOpen && selectedTaskId && (
          <TaskDetail taskId={selectedTaskId} onClose={() => selectTask(null)} />
        )}

        {/* Nag reminder system (headless) */}
        <NagReminder />

        {/* Global keyboard shortcuts */}
        <KeyboardShortcuts />

        {/* Toast notifications */}
        <Toaster
          theme="dark"
          position="bottom-center"
          toastOptions={{
            className: 'bg-card border-border text-foreground',
            duration: 5000,
          }}
        />
      </div>
    </AuthGuard>
  )
}
