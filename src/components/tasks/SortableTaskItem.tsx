'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { TaskItem } from './TaskItem'
import type { Task, Project } from '@/types/database'

interface SortableTaskItemProps {
  task: Task & { project?: Project | null }
  selectable?: boolean
  selected?: boolean
  onToggleSelect?: () => void
}

export function SortableTaskItem({ task, selectable, selected, onToggleSelect }: SortableTaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <TaskItem
      ref={setNodeRef}
      task={task}
      style={style}
      dragHandleProps={{ ...attributes, ...listeners }}
      selectable={selectable}
      selected={selected}
      onToggleSelect={onToggleSelect}
    />
  )
}
