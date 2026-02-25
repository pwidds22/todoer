'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUpdateTask, useDeleteTask, useCompleteTask, useSubtasks, useCreateTask } from '@/hooks/useTasks'
import { useProjects } from '@/hooks/useProjects'
import { useLabels } from '@/hooks/useLabels'
import { useAuth } from '@/hooks/useAuth'
import { cn, PRIORITY_COLORS, PRIORITY_LABELS, formatDueDate } from '@/lib/utils'
import { TaskCheckbox } from './TaskCheckbox'
import {
  X, Trash2, CalendarIcon, Clock, Flag, Hash, Tag,
  Bell, BellOff, Repeat, Plus, AlignLeft, Timer
} from 'lucide-react'
import type { Task } from '@/types/database'

interface TaskDetailProps {
  taskId: string
  onClose: () => void
}

export function TaskDetail({ taskId, onClose }: TaskDetailProps) {
  const [task, setTask] = useState<Task | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [subtaskInput, setSubtaskInput] = useState('')
  const supabase = createClient()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const completeTask = useCompleteTask()
  const createTask = useCreateTask()
  const { data: projects } = useProjects()
  const { data: labels } = useLabels()
  const { data: subtasks } = useSubtasks(taskId)
  const { user } = useAuth()

  useEffect(() => {
    async function fetchTask() {
      const { data } = await supabase.from('tasks').select('*').eq('id', taskId).single()
      const taskData = data as Task | null
      if (taskData) {
        setTask(taskData)
        setTitle(taskData.title)
        setDescription(taskData.description || '')
      }
    }
    fetchTask()
  }, [taskId, supabase])

  function saveField(field: string, value: any) {
    updateTask.mutate({ id: taskId, [field]: value })
    setTask(prev => prev ? { ...prev, [field]: value } : null)
  }

  async function addSubtask() {
    if (!subtaskInput.trim() || !user) return
    await createTask.mutateAsync({
      title: subtaskInput.trim(),
      user_id: user.id,
      parent_id: taskId,
      project_id: task?.project_id || null,
    })
    setSubtaskInput('')
  }

  if (!task) {
    return (
      <div className="w-96 border-l border-border bg-card flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground text-sm">Loading...</div>
      </div>
    )
  }

  return (
    <div className="w-96 border-l border-border bg-card flex flex-col h-full overflow-hidden shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <TaskCheckbox
            isCompleted={!!task.is_completed}
            priority={task.priority || 0}
            onToggle={() => {
              completeTask.mutate({ id: taskId, isCompleted: !task.is_completed })
              setTask(prev => prev ? { ...prev, is_completed: !prev.is_completed } : null)
            }}
          />
          <span className="text-xs text-muted-foreground">
            {task.is_completed ? 'Completed' : 'Active'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { deleteTask.mutate(taskId); onClose() }}
            className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-red-400 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button onClick={onClose} className="p-1.5 hover:bg-accent rounded text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Title */}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => { if (title !== task.title) saveField('title', title) }}
          className="w-full text-lg font-medium bg-transparent focus:outline-none"
        />

        {/* Description */}
        <div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <AlignLeft className="h-3 w-3" /> Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => { if (description !== (task.description || '')) saveField('description', description || null) }}
            rows={3}
            placeholder="Add description..."
            className="w-full text-sm bg-accent/30 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
          />
        </div>

        {/* Due Date */}
        <div className="flex items-center gap-3">
          <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">Due date</label>
            <input
              type="date"
              value={task.due_date || ''}
              onChange={(e) => saveField('due_date', e.target.value || null)}
              className="w-full text-sm bg-transparent focus:outline-none"
            />
          </div>
        </div>

        {/* Due Time */}
        <div className="flex items-center gap-3">
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">Due time</label>
            <input
              type="time"
              value={task.due_time || ''}
              onChange={(e) => saveField('due_time', e.target.value || null)}
              className="w-full text-sm bg-transparent focus:outline-none"
            />
          </div>
        </div>

        {/* Priority */}
        <div className="flex items-center gap-3">
          <Flag className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">Priority</label>
            <div className="flex gap-1 mt-1">
              {[0, 1, 2, 3, 4].map((p) => (
                <button
                  key={p}
                  onClick={() => saveField('priority', p)}
                  className={cn(
                    'px-2 py-0.5 rounded text-xs font-medium transition-colors',
                    task.priority === p
                      ? `${PRIORITY_COLORS[p]} bg-accent`
                      : 'text-muted-foreground hover:bg-accent'
                  )}
                >
                  {PRIORITY_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Project */}
        <div className="flex items-center gap-3">
          <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">Project</label>
            <select
              value={task.project_id || ''}
              onChange={(e) => saveField('project_id', e.target.value || null)}
              className="w-full text-sm bg-transparent focus:outline-none mt-0.5"
            >
              <option value="">Inbox</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Nag Toggle */}
        <div className="flex items-center gap-3">
          {task.nag_enabled ? (
            <Bell className="h-4 w-4 text-orange-400 shrink-0" />
          ) : (
            <BellOff className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <div className="flex-1 flex items-center justify-between">
            <div>
              <label className="text-sm">Nag me</label>
              <p className="text-xs text-muted-foreground">
                {task.nag_enabled ? `Every ${(task.nag_interval || 60)}s until done` : 'Off'}
              </p>
            </div>
            <button
              onClick={() => saveField('nag_enabled', !task.nag_enabled)}
              className={cn(
                'w-10 h-5 rounded-full transition-colors relative',
                task.nag_enabled ? 'bg-orange-500' : 'bg-border'
              )}
            >
              <div className={cn(
                'w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform',
                task.nag_enabled ? 'translate-x-5' : 'translate-x-0.5'
              )} />
            </button>
          </div>
        </div>

        {/* Nag interval */}
        {task.nag_enabled && (
          <div className="ml-7">
            <label className="text-xs text-muted-foreground">Nag interval</label>
            <select
              value={task.nag_interval || 60}
              onChange={(e) => saveField('nag_interval', parseInt(e.target.value))}
              className="w-full text-sm bg-transparent focus:outline-none mt-0.5"
            >
              <option value={30}>Every 30 seconds</option>
              <option value={60}>Every 1 minute</option>
              <option value={120}>Every 2 minutes</option>
              <option value={300}>Every 5 minutes</option>
              <option value={600}>Every 10 minutes</option>
            </select>
          </div>
        )}

        {/* Duration */}
        <div className="flex items-center gap-3">
          <Timer className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">Duration (minutes)</label>
            <input
              type="number"
              min={0}
              value={task.duration_minutes || ''}
              onChange={(e) => saveField('duration_minutes', e.target.value ? parseInt(e.target.value) : null)}
              placeholder="Estimate"
              className="w-full text-sm bg-transparent focus:outline-none mt-0.5"
            />
          </div>
        </div>

        {/* Subtasks */}
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">Subtasks</label>
          <div className="space-y-1">
            {subtasks?.map((sub) => (
              <div key={sub.id} className="flex items-center gap-2 pl-1">
                <TaskCheckbox
                  isCompleted={!!sub.is_completed}
                  priority={0}
                  onToggle={() => completeTask.mutate({ id: sub.id, isCompleted: !sub.is_completed })}
                />
                <span className={cn('text-sm', sub.is_completed && 'line-through text-muted-foreground')}>
                  {sub.title}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Plus className="h-4 w-4 text-muted-foreground" />
            <input
              value={subtaskInput}
              onChange={(e) => setSubtaskInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addSubtask() }}
              placeholder="Add subtask..."
              className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
        Created {new Date(task.created_at!).toLocaleDateString()}
      </div>
    </div>
  )
}
