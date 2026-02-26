'use client'

import { useState, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { SortableTaskItem } from './SortableTaskItem'
import { TaskItem } from './TaskItem'
import { useReorderTasks, useCompleteTask, useDeleteTask } from '@/hooks/useTasks'
import type { Task, Project } from '@/types/database'
import { CheckCircle2, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TaskListProps {
  tasks: (Task & { project?: Project | null })[]
  emptyMessage?: string
  groupBy?: 'date' | 'priority' | 'project' | 'none'
  sortable?: boolean
}

function groupByDate(tasks: TaskListProps['tasks']) {
  const groups: Record<string, typeof tasks> = {}

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

export function TaskList({ tasks, emptyMessage = 'No tasks', groupBy = 'none', sortable = false }: TaskListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const reorderTasks = useReorderTasks()
  const completeTask = useCompleteTask()
  const deleteTask = useDeleteTask()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const toggleSelect = useCallback((taskId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }, [])

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  function handleBulkComplete() {
    selectedIds.forEach(id => {
      completeTask.mutate({ id, isCompleted: true })
    })
    clearSelection()
  }

  function handleBulkDelete() {
    selectedIds.forEach(id => {
      deleteTask.mutate(id)
    })
    clearSelection()
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id || !tasks) return

    const oldIndex = tasks.findIndex(t => t.id === active.id)
    const newIndex = tasks.findIndex(t => t.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(tasks, oldIndex, newIndex)
    const updates = reordered.map((task, idx) => ({
      id: task.id,
      position: idx,
    }))
    reorderTasks.mutate(updates)
  }

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
                <TaskItem
                  key={task.id}
                  task={task}
                  selectable
                  selected={selectedIds.has(task.id)}
                  onToggleSelect={() => toggleSelect(task.id)}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Bulk action bar */}
        <BulkActionBar
          count={selectedIds.size}
          onComplete={handleBulkComplete}
          onDelete={handleBulkDelete}
          onClear={clearSelection}
        />
      </div>
    )
  }

  // Sortable list
  if (sortable) {
    return (
      <>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
            {tasks.map((task) => (
              <SortableTaskItem
                key={task.id}
                task={task}
                selectable
                selected={selectedIds.has(task.id)}
                onToggleSelect={() => toggleSelect(task.id)}
              />
            ))}
          </SortableContext>
        </DndContext>

        <BulkActionBar
          count={selectedIds.size}
          onComplete={handleBulkComplete}
          onDelete={handleBulkDelete}
          onClear={clearSelection}
        />
      </>
    )
  }

  return (
    <>
      <div>
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            selectable
            selected={selectedIds.has(task.id)}
            onToggleSelect={() => toggleSelect(task.id)}
          />
        ))}
      </div>

      <BulkActionBar
        count={selectedIds.size}
        onComplete={handleBulkComplete}
        onDelete={handleBulkDelete}
        onClear={clearSelection}
      />
    </>
  )
}

function BulkActionBar({ count, onComplete, onDelete, onClear }: {
  count: number
  onComplete: () => void
  onDelete: () => void
  onClear: () => void
}) {
  if (count === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-2 bg-card border border-border rounded-xl shadow-2xl px-4 py-2.5">
        <span className="text-sm font-medium mr-2">{count} selected</span>
        <button
          onClick={onComplete}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-500/10 text-green-500 rounded-lg hover:bg-green-500/20 transition-colors"
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> Complete
        </button>
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </button>
        <button
          onClick={onClear}
          className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
