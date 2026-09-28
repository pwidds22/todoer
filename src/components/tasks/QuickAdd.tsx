'use client'

import { useState, useRef, useEffect, useId } from 'react'
import { useCreateTask } from '@/hooks/useTasks'
import { useAuth } from '@/hooks/useAuth'
import { useProjects } from '@/hooks/useProjects'
import { parseTaskInput, type ParsedTask } from '@/lib/nlp'
import { REMINDER_INTERVALS, setTaskReminderPreference } from '@/lib/reminders/preferences'
import { RecurrencePicker } from './RecurrencePicker'
import { Plus, Send } from 'lucide-react'
import { toast } from 'sonner'

interface QuickAddProps {
  defaultProjectId?: string
  defaultSectionId?: string
}

type CapturePreview = ParsedTask & { recurrenceType: string | null }
const fieldClass = 'mt-1 w-full min-w-0 rounded-md border border-border bg-background px-2 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary'

export function QuickAdd({ defaultProjectId, defaultSectionId }: QuickAddProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [preview, setPreview] = useState<CapturePreview | null>(null)
  // null means use the captured project; an empty string explicitly means Inbox.
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [reviewed, setReviewed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const submittingRef = useRef(false)
  const formId = useId()
  const createTask = useCreateTask()
  const { user } = useAuth()
  const { data: projects } = useProjects()

  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'q' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return
        e.preventDefault()
        setIsOpen(true)
      }
      if (e.key === 'Escape' && !submittingRef.current) {
        // Closing with Escape preserves an unfinished draft.
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  function changeInput(value: string) {
    setInput(value)
    const parsed = value.trim() ? parseTaskInput(value) : null
    setPreview(parsed ? { ...parsed, recurrenceType: parsed.recurrence ? 'fixed' : null } : null)
    setSelectedProject(null)
    setReviewed(false)
    setError(null)
  }

  function editPreview(changes: Partial<CapturePreview>) {
    setPreview(current => current ? { ...current, ...changes } : current)
    setError(null)
  }

  const capturedProject = preview?.projectName
    ? projects?.find(project => project.name.toLowerCase() === preview.projectName!.toLowerCase())
    : null
  const unknownProject = selectedProject === null && !!preview?.projectName && !capturedProject
  const projectId = selectedProject ?? (capturedProject?.id || defaultProjectId || '')
  const needsReview = !!preview && (preview.requiresReview || preview.labelNames.length > 0)
  const reminderNeedsSchedule = !!preview && preview.reminderMode !== 'off' && (!preview.dueDate || !preview.dueTime)
  const reminderNeedsInterval = preview?.reminderMode === 'persistent' && !preview.reminderIntervalSeconds
  const timeNeedsDate = !!preview?.dueTime && !preview.dueDate
  const canSave = !!user && !!preview?.title.trim() && !preview.ambiguousTime &&
    !unknownProject && !reminderNeedsSchedule && !reminderNeedsInterval && !timeNeedsDate &&
    (!needsReview || reviewed) && !createTask.isPending

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSave || !preview || !user || submittingRef.current) return
    submittingRef.current = true
    setError(null)

    // Submit the visible, edited preview. Re-parsing here would lose corrections.
    const draft = preview
    try {
      const task = await createTask.mutateAsync({
        title: draft.title.trim(),
        user_id: user.id,
        project_id: projectId || null,
        section_id: projectId === (defaultProjectId || '') ? defaultSectionId || null : null,
        due_date: draft.dueDate,
        due_time: draft.dueTime,
        priority: draft.priority,
        recurrence_rule: draft.recurrence,
        recurrence_type: draft.recurrence ? draft.recurrenceType : null,
        // Reminder consent belongs to this recipient and device, never to a
        // shared task's owner-controlled notification flags.
        nag_enabled: false,
        reminder_enabled: false,
      })

      if (draft.reminderMode !== 'off') {
        try {
          setTaskReminderPreference(user.id, task.id, {
            enabled: true,
            mode: draft.reminderMode,
            intervalSeconds: draft.reminderIntervalSeconds || 60,
          })
        } catch (reminderError) {
          // The task already exists: never offer to retry its creation when
          // only the local reminder preference failed to save.
          toast.error(`Task saved, but its reminder was not saved. ${reminderError instanceof Error ? reminderError.message : 'Open the task to enable its reminder again.'}`)
        }
      }

      setInput('')
      setPreview(null)
      setSelectedProject(null)
      setReviewed(false)
      setIsOpen(false)
    } catch (saveError) {
      setError(`Could not confirm the save. Your draft is still here. Check the list before retrying. ${saveError instanceof Error ? saveError.message : ''}`)
    } finally {
      submittingRef.current = false
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-primary transition-colors group w-full"
      >
        <Plus className="h-4 w-4 text-primary" />
        <span>{input ? 'Continue adding task' : 'Add task'}</span>
        <kbd className="ml-auto text-xs bg-accent px-1.5 py-0.5 rounded text-muted-foreground group-hover:text-foreground">Q</kbd>
      </button>
    )
  }

  return (
    <div className="border border-border rounded-lg bg-card">
      <form id={formId} onSubmit={handleSubmit} className="flex items-center gap-2 p-3">
        <label className="sr-only" htmlFor={`${formId}-input`}>Describe a task</label>
        <input
          id={`${formId}-input`}
          ref={inputRef}
          value={input}
          onChange={e => changeInput(e.target.value)}
          disabled={createTask.isPending}
          placeholder='Call the dentist tomorrow at 10 and remind me every minute until done'
          className="min-w-0 flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={!canSave}
          className="flex shrink-0 items-center gap-1.5 p-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors text-xs"
        >
          <Send className="h-3.5 w-3.5" aria-hidden="true" />
          {createTask.isPending ? 'Saving…' : 'Save task'}
        </button>
      </form>

      {preview && (
        <fieldset disabled={createTask.isPending} className="min-w-0 border-t border-border px-3 pb-3 space-y-3">
          <legend className="px-1 text-xs font-medium">Review one task</legend>
          <p className="text-xs text-muted-foreground">Edit these details before saving. Changing the description above resets this preview.</p>
          <label className="block text-xs text-muted-foreground">
            Task title
            <input value={preview.title} onChange={e => editPreview({ title: e.target.value })} className={fieldClass} />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block min-w-0 text-xs text-muted-foreground">
              Due date
              <input type="date" value={preview.dueDate || ''} onChange={e => editPreview({ dueDate: e.target.value || null })} className={fieldClass} />
            </label>
            <label className="block min-w-0 text-xs text-muted-foreground">
              Due time
              <input
                type="time"
                value={preview.dueTime || ''}
                onChange={e => editPreview({ dueTime: e.target.value || null, ambiguousTime: null })}
                className={fieldClass}
                aria-describedby={preview.ambiguousTime ? `${formId}-time-choice` : undefined}
              />
            </label>
          </div>

          {preview.ambiguousTime && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
              <p id={`${formId}-time-choice`}>“{preview.ambiguousTime.text}” needs AM or PM. Choose a time to continue, or save without a time.</p>
              <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Confirm AM or PM">
                {(['am', 'pm'] as const).map(period => (
                  <button
                    key={period}
                    type="button"
                    onClick={() => editPreview({ dueTime: preview.ambiguousTime![period], ambiguousTime: null })}
                    className="rounded border border-border bg-background px-3 py-2 font-medium"
                  >
                    {Number(preview.ambiguousTime![period].slice(0, 2)) % 12 || 12}:{preview.ambiguousTime![period].slice(3)} {period.toUpperCase()}
                  </button>
                ))}
                <button type="button" onClick={() => editPreview({ dueTime: null, ambiguousTime: null, reminderMode: 'off' })} className="rounded border border-border bg-background px-3 py-2">
                  No time or reminder
                </button>
              </div>
            </div>
          )}

          <RecurrencePicker
            value={preview.recurrence}
            recurrenceType={preview.recurrenceType}
            onChange={(recurrence, recurrenceType) => editPreview({ recurrence, recurrenceType })}
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-xs text-muted-foreground">
              Reminder on this device
              <select value={preview.reminderMode} onChange={e => editPreview({ reminderMode: e.target.value as ParsedTask['reminderMode'] })} className={fieldClass}>
                <option value="off">Off</option>
                <option value="once">Once when due</option>
                <option value="persistent">Repeat until done</option>
              </select>
            </label>
            {preview.reminderMode === 'persistent' && (
              <label className="block text-xs text-muted-foreground">
                Reminder interval
                <select value={preview.reminderIntervalSeconds || ''} onChange={e => editPreview({ reminderIntervalSeconds: Number(e.target.value) || null })} className={fieldClass}>
                  <option value="">Choose an interval</option>
                  {REMINDER_INTERVALS.map(seconds => <option key={seconds} value={seconds}>Every {seconds / 60} {seconds === 60 ? 'minute' : 'minutes'}</option>)}
                </select>
              </label>
            )}
          </div>
          {preview.reminderMode !== 'off' && (
            <p className="text-xs text-muted-foreground">Reminders are personal to this account and device. Enable this device in Settings. Quiet hours apply. Browser reminders work only while the app is open.</p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-xs text-muted-foreground">
              List
              <select value={unknownProject ? '__unresolved__' : projectId} onChange={e => setSelectedProject(e.target.value)} className={fieldClass}>
                {unknownProject && <option value="__unresolved__" disabled>Choose a list for #{preview.projectName}</option>}
                <option value="">Inbox</option>
                {projectId && !projects?.some(project => project.id === projectId) && <option value={projectId}>Current list</option>}
                {projects?.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </label>
            <label className="block text-xs text-muted-foreground">
              Priority
              <select value={preview.priority} onChange={e => editPreview({ priority: Number(e.target.value) })} className={fieldClass}>
                <option value={0}>None</option>
                {[1, 2, 3, 4].map(priority => <option key={priority} value={priority}>P{priority}</option>)}
              </select>
            </label>
          </div>

          {(preview.warnings.length > 0 || preview.labelNames.length > 0) && (
            <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
              {preview.warnings.map(warning => <p key={warning}>{warning}</p>)}
              {preview.labelNames.length > 0 && <p>Labels {preview.labelNames.map(name => `@${name}`).join(', ')} will not be attached by Quick Add.</p>}
              {needsReview && (
                <label className="flex items-start gap-2">
                  <input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} className="mt-0.5" />
                  I reviewed these details and want to save one task.
                </label>
              )}
            </div>
          )}

          {unknownProject && <p className="text-xs text-amber-500">Choose a list above; #{preview.projectName} has not been matched to an available list.</p>}
          {reminderNeedsSchedule && !preview.ambiguousTime && <p className="text-xs text-amber-500">Choose a due date and time to use this reminder, or turn the reminder off.</p>}
          {timeNeedsDate && preview.reminderMode === 'off' && <p className="text-xs text-amber-500">Choose a due date for this time, or clear the time.</p>}
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        </fieldset>
      )}

      <div className="px-3 py-2 border-t border-border flex justify-between gap-3 items-center">
        <span className="text-xs text-muted-foreground"># list, p1–p4, “every day/week/monday”</span>
        <button
          type="button"
          disabled={createTask.isPending}
          onClick={() => setIsOpen(false)}
          className="shrink-0 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          Close draft
        </button>
      </div>
    </div>
  )
}
