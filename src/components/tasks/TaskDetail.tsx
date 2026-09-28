'use client'

import { useState, useEffect, useRef, useId } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUpdateTask, useDeleteTask, useCompleteTask, useSubtasks, useCreateTask } from '@/hooks/useTasks'
import { useProjects } from '@/hooks/useProjects'
import { useAuth } from '@/hooks/useAuth'
import { cn, PRIORITY_COLORS, PRIORITY_LABELS } from '@/lib/utils'
import { TaskCheckbox } from './TaskCheckbox'
import {
  X, Trash2, CalendarIcon, Clock, Flag, Hash,
  Plus, AlignLeft, Timer, Check
} from 'lucide-react'
import { ReminderControls } from './ReminderControls'
import { RecurrencePicker } from './RecurrencePicker'
import type { Task, TaskUpdate } from '@/types/database'

interface TaskDetailProps {
  taskId: string
  onClose: () => void
}

const panelClass = 'fixed inset-0 z-50 md:static md:w-96 border-l border-border bg-card flex flex-col h-full overflow-hidden shrink-0'

export function TaskDetail({ taskId, onClose }: TaskDetailProps) {
  const [task, setTask] = useState<Task | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [subtaskInput, setSubtaskInput] = useState('')
  const [loadError, setLoadError] = useState(false)
  const [subtaskError, setSubtaskError] = useState(false)
  const subtaskSubmitting = useRef(false)
  const dueDateRef = useRef<HTMLInputElement>(null)
  const formId = useId()
  const supabase = createClient()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const completeTask = useCompleteTask()
  const createTask = useCreateTask()
  const { data: projects } = useProjects()
  const { data: subtasks } = useSubtasks(taskId)
  const { user } = useAuth()

  useEffect(() => {
    let active = true
    setTask(null)
    setLoadError(false)
    setSubtaskInput('')
    setSubtaskError(false)
    async function fetchTask() {
      const { data, error } = await supabase.from('tasks').select('*').eq('id', taskId).single()
      if (!active) return
      if (error) { setLoadError(true); return }
      const taskData = data as Task | null
      if (taskData) {
        setTask(taskData)
        setTitle(taskData.title)
        setDescription(taskData.description || '')
      } else setLoadError(true)
    }
    void fetchTask().catch(() => { if (active) setLoadError(true) })
    return () => { active = false }
  }, [taskId, supabase])

  function saveFields(fields: TaskUpdate) {
    if (!task || updateTask.isPending) return
    updateTask.mutate({ id: taskId, expectedUpdatedAt: task.updated_at, ...fields }, {
      onSuccess: saved => { setTask(saved); setTitle(saved.title); setDescription(saved.description || '') },
    })
  }
  function saveField(field: keyof TaskUpdate, value: TaskUpdate[keyof TaskUpdate]) {
    saveFields({ [field]: value })
  }

  async function addSubtask() {
    if (!subtaskInput.trim() || !user || createTask.isPending || subtaskSubmitting.current) return
    subtaskSubmitting.current = true
    setSubtaskError(false)
    try {
      await createTask.mutateAsync({
        title: subtaskInput.trim(),
        user_id: user.id,
        parent_id: taskId,
        project_id: task?.project_id || null,
      })
      setSubtaskInput('')
    } catch {
      // The shared mutation handler reports the error; keep the entered text
      // and consume the rejection so Enter cannot create an unhandled promise.
      setSubtaskError(true)
    } finally {
      subtaskSubmitting.current = false
    }
  }

  function toggleComplete() {
    if (!task || completeTask.isPending || updateTask.isPending || deleteTask.isPending) return
    completeTask.mutate({ id: taskId, isCompleted: !task.is_completed, expectedUpdatedAt: task.updated_at }, { onSuccess: () => onClose() })
  }

  if (!task) {
    return (
      <div role="dialog" aria-label="Task details" className={panelClass}>
        <div className="flex justify-end px-4 py-3 border-b border-border">
          <button type="button" aria-label="Close task details" onClick={onClose} className="p-1.5 hover:bg-accent rounded text-muted-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          {loadError ? <p role="alert" className="text-sm">Could not load this task. Check your connection.</p> : <p role="status" className="animate-pulse text-muted-foreground text-sm">Loading task…</p>}
        </div>
      </div>
    )
  }

  return (
    <div role="dialog" aria-label="Task details" className={panelClass}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <TaskCheckbox
            label={`Complete ${task.title}`}
            isCompleted={!!task.is_completed}
            priority={task.priority || 0}
            disabled={completeTask.isPending || updateTask.isPending || deleteTask.isPending}
            onToggle={toggleComplete}
          />
          <span className="text-xs text-muted-foreground">
            {task.is_completed ? 'Completed' : 'Active'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            aria-label="Delete task"
            disabled={deleteTask.isPending}
            onClick={() => deleteTask.mutate(taskId, { onSuccess: () => onClose() })}
            className="p-1.5 hover:bg-accent rounded text-muted-foreground hover:text-red-400 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button aria-label="Close task details" onClick={onClose} className="p-1.5 hover:bg-accent rounded text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <fieldset disabled={updateTask.isPending || completeTask.isPending || deleteTask.isPending} className="flex-1 overflow-y-auto p-4 space-y-4 min-w-0">
        {/* Title */}
        <input
          value={title}
          aria-label="Task title"
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => { if (title !== task.title) saveField('title', title) }}
          className="w-full text-lg font-medium bg-transparent focus:outline-none"
        />

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={toggleComplete} className="flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            <Check className="h-4 w-4" aria-hidden="true" />
            {task.is_completed ? 'Mark active' : 'Done'}
          </button>
          <button type="button" onClick={() => dueDateRef.current?.focus()} className="flex items-center justify-center gap-2 rounded-md bg-accent px-3 py-2 text-sm">
            <CalendarIcon className="h-4 w-4" aria-hidden="true" /> Reschedule
          </button>
        </div>

        <ReminderControls task={task} />

        {/* Description */}
        <div>
          <label htmlFor={`${formId}-description`} className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <AlignLeft className="h-3 w-3" /> Description
          </label>
          <textarea
            id={`${formId}-description`}
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
            <label htmlFor={`${formId}-due-date`} className="text-xs text-muted-foreground">Due date</label>
            <input
              id={`${formId}-due-date`}
              ref={dueDateRef}
              type="date"
              value={task.due_date || ''}
              onChange={(e) => saveField('due_date', e.target.value || null)}
              className="w-full rounded text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        {/* Due Time */}
        <div className="flex items-center gap-3">
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1">
            <label htmlFor={`${formId}-due-time`} className="text-xs text-muted-foreground">Due time</label>
            <input
              id={`${formId}-due-time`}
              type="time"
              value={task.due_time || ''}
              onChange={(e) => saveField('due_time', e.target.value || null)}
              className="w-full text-sm bg-transparent focus:outline-none"
            />
          </div>
        </div>

        {/* Recurrence */}
        <RecurrencePicker
          value={task.recurrence_rule || null}
          recurrenceType={task.recurrence_type || null}
          onChange={(rule, type) => {
            saveFields({ recurrence_rule: rule, recurrence_type: type })
          }}
        />

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
              className="w-full text-sm bg-accent/50 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/50 mt-0.5 [&>option]:bg-card [&>option]:text-foreground"
            >
              <option value="">Inbox</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

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
                  label={`Complete subtask ${sub.title}`}
                  isCompleted={!!sub.is_completed}
                  priority={0}
                  disabled={completeTask.isPending}
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
              aria-label="New subtask title"
              disabled={createTask.isPending}
              value={subtaskInput}
              onChange={(e) => { setSubtaskInput(e.target.value); setSubtaskError(false) }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addSubtask() } }}
              placeholder="Add subtask..."
              className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-muted-foreground"
            />
          </div>
          {subtaskError && <p role="alert" className="mt-2 text-xs text-red-400">Subtask was not saved. Your text is still here.</p>}
        </div>
      </fieldset>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
        Created {new Date(task.created_at!).toLocaleDateString()}
      </div>
    </div>
  )
}
