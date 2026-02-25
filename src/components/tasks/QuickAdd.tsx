'use client'

import { useState, useRef, useEffect } from 'react'
import { useCreateTask } from '@/hooks/useTasks'
import { useAuth } from '@/hooks/useAuth'
import { useProjects } from '@/hooks/useProjects'
import { useLabels } from '@/hooks/useLabels'
import { parseTaskInput } from '@/lib/nlp'
import { Plus, Send } from 'lucide-react'
import { cn, PRIORITY_COLORS } from '@/lib/utils'

interface QuickAddProps {
  defaultProjectId?: string
  defaultSectionId?: string
}

export function QuickAdd({ defaultProjectId, defaultSectionId }: QuickAddProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [preview, setPreview] = useState<ReturnType<typeof parseTaskInput> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const createTask = useCreateTask()
  const { user } = useAuth()
  const { data: projects } = useProjects()
  const { data: labels } = useLabels()

  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

  useEffect(() => {
    if (input.trim()) {
      setPreview(parseTaskInput(input))
    } else {
      setPreview(null)
    }
  }, [input])

  // Global keyboard shortcut: Q to open quick add
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'q' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
        e.preventDefault()
        setIsOpen(true)
      }
      if (e.key === 'Escape') {
        setIsOpen(false)
        setInput('')
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || !user) return

    const parsed = parseTaskInput(input)

    // Find project by name
    let projectId = defaultProjectId || null
    if (parsed.projectName && projects) {
      const match = projects.find(p => p.name.toLowerCase() === parsed.projectName!.toLowerCase())
      if (match) projectId = match.id
    }

    await createTask.mutateAsync({
      title: parsed.title,
      user_id: user.id,
      project_id: projectId,
      section_id: defaultSectionId || null,
      due_date: parsed.dueDate,
      due_time: parsed.dueTime,
      priority: parsed.priority,
      recurrence_rule: parsed.recurrence,
      recurrence_type: parsed.recurrence ? 'fixed' : null,
      nag_enabled: !!parsed.dueTime, // Auto-enable nag if time is set
    })

    setInput('')
    setPreview(null)
    setIsOpen(false)
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-primary transition-colors group w-full"
      >
        <Plus className="h-4 w-4 text-primary" />
        <span>Add task</span>
        <kbd className="ml-auto text-xs bg-accent px-1.5 py-0.5 rounded text-muted-foreground group-hover:text-foreground">Q</kbd>
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="border border-border rounded-lg bg-card overflow-hidden">
      <div className="flex items-center gap-2 p-3">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='Add task... e.g. "Buy groceries tomorrow 5pm p2 #personal"'
          className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={!input.trim() || createTask.isPending}
          className="p-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Preview bar */}
      {preview && input.trim() && (
        <div className="px-3 py-1.5 border-t border-border bg-accent/30 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          {preview.dueDate && (
            <span>📅 {preview.dueDate}{preview.dueTime ? ` ${preview.dueTime}` : ''}</span>
          )}
          {preview.priority > 0 && (
            <span className={PRIORITY_COLORS[preview.priority]}>P{preview.priority}</span>
          )}
          {preview.projectName && (
            <span>#{preview.projectName}</span>
          )}
          {preview.labelNames.map(l => (
            <span key={l}>@{l}</span>
          ))}
          {preview.recurrence && (
            <span>🔁 {preview.recurrence}</span>
          )}
        </div>
      )}

      <div className="px-3 py-1.5 border-t border-border flex justify-between items-center">
        <span className="text-xs text-muted-foreground">
          Use # for project, @ for label, p1-p4 for priority
        </span>
        <button
          type="button"
          onClick={() => { setIsOpen(false); setInput('') }}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
