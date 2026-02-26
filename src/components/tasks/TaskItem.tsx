'use client'

import { cn, formatDueDate, isOverdue, PRIORITY_COLORS } from '@/lib/utils'
import { describeRRule } from '@/lib/recurrence'
import { TaskCheckbox } from './TaskCheckbox'
import { useCompleteTask } from '@/hooks/useTasks'
import { useUIStore } from '@/stores/ui-store'
import type { Task, Project } from '@/types/database'
import { Bell, CalendarIcon, Hash, Repeat, GripVertical } from 'lucide-react'
import { forwardRef } from 'react'

interface TaskItemProps {
  task: Task & { project?: Project | null }
  selectable?: boolean
  selected?: boolean
  onToggleSelect?: () => void
  dragHandleProps?: any
  style?: React.CSSProperties
}

export const TaskItem = forwardRef<HTMLDivElement, TaskItemProps>(function TaskItem(
  { task, selectable, selected, onToggleSelect, dragHandleProps, style },
  ref
) {
  const completeTask = useCompleteTask()
  const { selectTask } = useUIStore()
  const overdue = isOverdue(task.due_date, task.due_time)
  const dueDateStr = formatDueDate(task.due_date, task.due_time)

  function handleClick(e: React.MouseEvent) {
    // If shift-clicking and selectable, toggle selection instead
    if (e.shiftKey && selectable && onToggleSelect) {
      e.preventDefault()
      onToggleSelect()
      return
    }
    selectTask(task.id)
  }

  return (
    <div
      ref={ref}
      style={style}
      onClick={handleClick}
      className={cn(
        'group flex items-start gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors hover:bg-accent/50',
        task.is_completed && 'opacity-50',
        selected && 'bg-primary/10 ring-1 ring-primary/30'
      )}
    >
      {/* Drag handle */}
      {dragHandleProps && (
        <div
          {...dragHandleProps}
          className="pt-1 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity touch-none"
        >
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      )}

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
            <span className="flex items-center gap-1 text-xs text-blue-400">
              <Repeat className="h-3 w-3" />
              {describeRRule(task.recurrence_rule)}
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
})
