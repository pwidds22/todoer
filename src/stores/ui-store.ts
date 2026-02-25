import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIState {
  sidebarOpen: boolean
  sidebarCollapsed: boolean
  selectedTaskId: string | null
  taskDetailOpen: boolean
  quickAddOpen: boolean
  theme: 'light' | 'dark' | 'system'

  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  selectTask: (taskId: string | null) => void
  setTaskDetailOpen: (open: boolean) => void
  setQuickAddOpen: (open: boolean) => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      sidebarCollapsed: false,
      selectedTaskId: null,
      taskDetailOpen: false,
      quickAddOpen: false,
      theme: 'dark',

      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      selectTask: (taskId) => set({ selectedTaskId: taskId, taskDetailOpen: !!taskId }),
      setTaskDetailOpen: (open) => set({ taskDetailOpen: open, selectedTaskId: open ? undefined : null }),
      setQuickAddOpen: (open) => set({ quickAddOpen: open }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'todoer-ui',
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
)
