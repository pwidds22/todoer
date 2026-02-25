'use client'

import { cn, formatDueDate, isOverdue, PRIORITY_COLORS } from '@/lib/utils'
import { TaskCheckbox } from './TaskCheckbox'
import { useCompleteTask } from '@/hooks/useTasks'
import { useUIStore } from '@/stores/ui-store'
import type { Task, Project } from '@/types/database'
import { Bell, CalendarIcon, Hash, Repeat } from 'lucide-react'

interface TaskItemProps {
  task: Task & { project?: Project | null }
}

export function TaskItem({ task }: TaskItemProps) {
  const completeTask = useCompleteTask()
  const { selectTask } = useUIStore()
  const overdue = isOverdue(task.due_date, task.due_time)
  const dueDateStr = formatDueDate(task.due_date, task.due_time)

  return (
    <div
      onClick={() => selectTask(task.id)}
      className={cn(
        'group flex items-start gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors hover:bg-accent/50',
        task.is_completed && 'opacity-50'
      )}
    >
      <div className="pt-0.5">
        <TaskCheckbox
          isCompleted={!!task.is_completed}
          priority={task.priority || 0}
          onToggle={() => completeTask.mutate({ id: task.id, isCompleted: !task.is_completed })}
        />
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm leading-tight',
          task.is_completed && 'line-through text-muted-foreground'
        )}>
          {task.title}
        </p>

        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {dueDateStr && (
            <span className={cn(
              'flex items-center gap-1 text-xs',
              overdue ? 'text-red-400' : 'text-muted-foreground'
            )}>
              <CalendarIcon className="h-3 w-3" />
              {dueDateStr}
            </span>
          )}

          {task.project && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Hash className="h-3 w-3" style={{ color: (task.project as any).color || undefined }} />
              {(task.project as any).name}
            </span>
          )}

          {task.nag_enabled && (
            <span className="flex items-center gap-1 text-xs text-orange-400">
              <Bell className="h-3 w-3" />
              Nag
            </span>
          )}

          {task.recurrence_rule && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Repeat className="h-3 w-3" />
            </span>
          )}

          {task.priority !== null && task.priority > 0 && (
            <span className={cn('text-xs font-medium', PRIORITY_COLORS[task.priority || 0])}>
              P{task.priority}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
