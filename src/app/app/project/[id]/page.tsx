'use client'

import { use, useState, useRef, useEffect } from 'react'
import { useProject, useSections, useCreateSection } from '@/hooks/useProjects'
import { useTasks } from '@/hooks/useTasks'
import { TaskList } from '@/components/tasks/TaskList'
import { QuickAdd } from '@/components/tasks/QuickAdd'
import { Hash, Plus, Star } from 'lucide-react'
import { useUpdateProject } from '@/hooks/useProjects'
import { cn } from '@/lib/utils'

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: project } = useProject(id)
  const { data: tasks, isLoading } = useTasks({ projectId: id, isCompleted: false })
  const { data: sections } = useSections(id)
  const updateProject = useUpdateProject()
  const createSection = useCreateSection()
  const [showSectionForm, setShowSectionForm] = useState(false)
  const [sectionName, setSectionName] = useState('')
  const sectionInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showSectionForm) sectionInputRef.current?.focus()
  }, [showSectionForm])

  function handleCreateSection() {
    const trimmed = sectionName.trim()
    if (!trimmed) return

    createSection.mutate(
      { name: trimmed, project_id: id },
      {
        onSuccess: () => {
          setSectionName('')
          setShowSectionForm(false)
        },
      }
    )
  }

  if (!project) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="h-8 w-48 bg-accent/30 rounded animate-pulse" />
      </div>
    )
  }

  // Group tasks by section
  const unsectionedTasks = tasks?.filter(t => !t.section_id) || []
  const sectionedTasks = sections?.map(s => ({
    section: s,
    tasks: tasks?.filter(t => t.section_id === s.id) || [],
  })) || []

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          {project.icon ? (
            <span className="text-2xl">{project.icon}</span>
          ) : (
            <Hash className="h-6 w-6" style={{ color: project.color || undefined }} />
          )}
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <button
            onClick={() => updateProject.mutate({ id: project.id, is_favorite: !project.is_favorite })}
            className={cn(
              'p-1 hover:bg-accent rounded transition-colors',
              project.is_favorite ? 'text-yellow-500' : 'text-muted-foreground'
            )}
          >
            <Star className="h-4 w-4" fill={project.is_favorite ? 'currentColor' : 'none'} />
          </button>
        </div>
        {project.description && (
          <p className="text-sm text-muted-foreground ml-9">{project.description}</p>
        )}
      </div>

      <div className="mb-4">
        <QuickAdd defaultProjectId={id} />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-accent/30 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Unsectioned tasks */}
          {unsectionedTasks.length > 0 && (
            <TaskList tasks={unsectionedTasks} />
          )}

          {/* Sectioned tasks */}
          {sectionedTasks.map(({ section, tasks: sectionTasks }) => (
            <div key={section.id}>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-3 py-1 border-b border-border mb-1">
                {section.name}
              </h3>
              <TaskList tasks={sectionTasks} emptyMessage="No tasks in this section" />
              <QuickAdd defaultProjectId={id} defaultSectionId={section.id} />
            </div>
          ))}

          {/* Add section */}
          {showSectionForm ? (
            <div className="px-3 py-2">
              <input
                ref={sectionInputRef}
                type="text"
                value={sectionName}
                onChange={e => setSectionName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreateSection()
                  if (e.key === 'Escape') {
                    setSectionName('')
                    setShowSectionForm(false)
                  }
                }}
                placeholder="Section name"
                className="w-full bg-transparent text-sm font-semibold uppercase tracking-wider border-b border-primary/50 outline-none py-1 placeholder:text-muted-foreground/50 placeholder:normal-case placeholder:tracking-normal placeholder:font-normal"
              />
            </div>
          ) : (
            <button
              onClick={() => setShowSectionForm(true)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground px-3 py-2 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add section
            </button>
          )}

          {unsectionedTasks.length === 0 && sectionedTasks.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-sm">No tasks yet. Add one above!</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
