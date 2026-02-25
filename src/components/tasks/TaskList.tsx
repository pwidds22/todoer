'use client'

import { TaskItem } from './TaskItem'
import type { Task, Project } from '@/types/database'

interface TaskListProps {
  tasks: (Task & { project?: Project | null })[]
  emptyMessage?: string
  groupBy?: 'date' | 'priority' | 'project' | 'none'
}

function groupByDate(tasks: TaskListProps['tasks']) {
  const groups: Record<string, typeof tasks> = {}

  // Overdue first
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  for (const task of tasks) {
    let key: string
    if (!task.due_date) {
      key = 'No date'
    } else if (task.due_date < todayStr) {
      key = 'Overdue'
    } else if (task.due_date === todayStr) {
      key = 'Today'
    } else {
      const d = new Date(task.due_date + 'T00:00:00')
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      if (task.due_date === tomorrow.toISOString().split('T')[0]) {
        key = 'Tomorrow'
      } else {
        key = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
      }
    }
    if (!groups[key]) groups[key] = []
    groups[key].push(task)
  }

  return groups
}

export function TaskList({ tasks, emptyMessage = 'No tasks', groupBy = 'none' }: TaskListProps) {
  if (!tasks || tasks.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-sm">{emptyMessage}</p>
      </div>
    )
  }

  if (groupBy === 'date') {
    const groups = groupByDate(tasks)
    const order = ['Overdue', 'Today', 'Tomorrow']

    const sortedKeys = Object.keys(groups).sort((a, b) => {
      const ai = order.indexOf(a)
      const bi = order.indexOf(b)
      if (ai !== -1 && bi !== -1) return ai - bi
      if (ai !== -1) return -1
      if (bi !== -1) return 1
      return 0
    })

    return (
      <div className="space-y-4">
        {sortedKeys.map((key) => (
          <div key={key}>
            <h3 className={`text-xs font-semibold uppercase tracking-wider px-3 py-1 ${key === 'Overdue' ? 'text-red-400' : 'text-muted-foreground'}`}>
              {key} <span className="text-muted-foreground font-normal">({groups[key].length})</span>
            </h3>
            <div>
              {groups[key].map((task) => (
                <TaskItem key={task.id} task={task} />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      {tasks.map((task) => (
        <TaskItem key={task.id} task={task} />
      ))}
    </div>
  )
}
