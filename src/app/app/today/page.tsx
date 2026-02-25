'use client'

import { useTodayTasks } from '@/hooks/useTasks'
import { TaskList } from '@/components/tasks/TaskList'
import { QuickAdd } from '@/components/tasks/QuickAdd'
import { Sun } from 'lucide-react'

export default function TodayPage() {
  const { data: tasks, isLoading } = useTodayTasks()

  const today = new Date()
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Sun className="h-6 w-6 text-yellow-500" />
          <h1 className="text-2xl font-bold">Today</h1>
        </div>
        <p className="text-sm text-muted-foreground ml-9">{dateStr}</p>
      </div>

      <div className="mb-4">
        <QuickAdd />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-accent/30 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <TaskList
          tasks={tasks || []}
          groupBy="date"
          emptyMessage="All clear for today! Add a task or enjoy your free time."
        />
      )}
    </div>
  )
}
