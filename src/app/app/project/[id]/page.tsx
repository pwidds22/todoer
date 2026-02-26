'use client'

import { use, useState, useRef, useEffect } from 'react'
import { useProject, useSections, useCreateSection, useDeleteProject } from '@/hooks/useProjects'
import { useTasks } from '@/hooks/useTasks'
import { TaskList } from '@/components/tasks/TaskList'
import { QuickAdd } from '@/components/tasks/QuickAdd'
import { Hash, Plus, Star, MoreHorizontal, Pencil, Archive, Trash2, X, AlertTriangle } from 'lucide-react'
import { useUpdateProject } from '@/hooks/useProjects'
import { cn } from '@/lib/utils'
import type { Project } from '@/types/database'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: project } = useProject(id)
  const { data: tasks, isLoading } = useTasks({ projectId: id, isCompleted: false })
  const { data: sections } = useSections(id)
  const updateProject = useUpdateProject()
  const deleteProject = useDeleteProject()
  const createSection = useCreateSection()
  const router = useRouter()
  const [showSectionForm, setShowSectionForm] = useState(false)
  const [sectionName, setSectionName] = useState('')
  const sectionInputRef = useRef<HTMLInputElement>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (showSectionForm) sectionInputRef.current?.focus()
  }, [showSectionForm])

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    if (showMenu) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showMenu])

  function handleDelete() {
    deleteProject.mutate(id, {
      onSuccess: () => {
        router.push('/app/today')
      },
    })
  }

  function handleArchive() {
    updateProject.mutate(
      { id, is_archived: true },
      { onSuccess: () => router.push('/app/today') }
    )
    setShowMenu(false)
  }

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

          {/* Project menu */}
          <div className="relative ml-auto" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 hover:bg-accent rounded transition-colors text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-lg shadow-lg py-1 z-50">
                <button
                  onClick={() => { setShowEditDialog(true); setShowMenu(false) }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit project
                </button>
                <button
                  onClick={handleArchive}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent transition-colors"
                >
                  <Archive className="h-3.5 w-3.5" /> Archive project
                </button>
                <div className="h-px bg-border my-1" />
                <button
                  onClick={() => { setShowDeleteConfirm(true); setShowMenu(false) }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete project
                </button>
              </div>
            )}
          </div>
        </div>
        {project.description && (
          <p className="text-sm text-muted-foreground ml-9">{project.description}</p>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-500/10 rounded-full">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <h2 className="text-lg font-semibold">Delete project</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                Are you sure you want to delete <strong>{project.name}</strong>?
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                This will permanently delete the project and all its sections. Tasks in this project will be moved to the Inbox.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-sm rounded-lg hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteProject.isPending}
                  className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {deleteProject.isPending ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit project dialog */}
      <AnimatePresence>
        {showEditDialog && (
          <EditProjectDialog
            project={project}
            onClose={() => setShowEditDialog(false)}
          />
        )}
      </AnimatePresence>

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

const PROJECT_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#14b8a6', '#06b6d4',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
  '#d946ef', '#ec4899', '#f43f5e', '#78716c',
]

function EditProjectDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  const updateProject = useUpdateProject()
  const [name, setName] = useState(project.name)
  const [color, setColor] = useState(project.color || '#3b82f6')
  const [description, setDescription] = useState(project.description || '')

  function handleSave() {
    if (!name.trim()) return
    updateProject.mutate(
      { id: project.id, name: name.trim(), color, description: description.trim() || undefined },
      { onSuccess: onClose }
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        onClick={e => e.stopPropagation()}
        className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md"
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold">Edit project</h2>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-accent rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional description..."
              className="w-full bg-accent rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Color</label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    'w-7 h-7 rounded-full transition-all',
                    color === c ? 'ring-2 ring-offset-2 ring-offset-card ring-primary scale-110' : 'hover:scale-110'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || updateProject.isPending}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {updateProject.isPending ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
