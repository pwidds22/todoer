'use client'

import { useTasks } from '@/hooks/useTasks'
import { TaskList } from '@/components/tasks/TaskList'
import { QuickAdd } from '@/components/tasks/QuickAdd'
import { Inbox } from 'lucide-react'

export default function InboxPage() {
  const { data: tasks, isLoading } = useTasks({ inbox: true, isCompleted: false })

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Inbox className="h-6 w-6 text-blue-500" />
          <h1 className="text-2xl font-bold">Inbox</h1>
        </div>
        <p className="text-sm text-muted-foreground ml-9">Tasks without a project</p>
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
          sortable
          emptyMessage="Inbox is empty. Capture tasks here and organize them later."
        />
      )}
    </div>
  )
}
