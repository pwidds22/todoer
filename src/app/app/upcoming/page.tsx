'use client'

import { useUpcomingTasks } from '@/hooks/useTasks'
import { TaskList } from '@/components/tasks/TaskList'
import { QuickAdd } from '@/components/tasks/QuickAdd'
import { Calendar } from 'lucide-react'

export default function UpcomingPage() {
  const { data: tasks, isLoading } = useUpcomingTasks()

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Calendar className="h-6 w-6 text-purple-500" />
          <h1 className="text-2xl font-bold">Upcoming</h1>
        </div>
        <p className="text-sm text-muted-foreground ml-9">Next 7 days</p>
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
          emptyMessage="No tasks scheduled for the next 7 days."
        />
      )}
    </div>
  )
}
