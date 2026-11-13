'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { Task, TaskInsert, Project } from '@/types/database'
import { createSupabaseTaskRepository, createTaskMutations, RecurrenceInsertError, runTaskMutation, type TaskCompletion, type TaskEdit } from '@/lib/task-mutations'
import { cancelTaskNativeReminders } from '@/lib/reminders/native'
import { getTaskReminderPreference, setTaskReminderPreference } from '@/lib/reminders/preferences'
import { localDateKey } from '@/lib/dates'
import { useLocalDate } from '@/hooks/useLocalDate'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'

const supabase = createClient()
const taskRepository = createSupabaseTaskRepository(supabase)
const taskMutations = createTaskMutations(taskRepository)

const mutationLifecycle = {
  phase(id: string, phase: 'start' | 'settled') {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('todoer:task-mutation', { detail: { id, phase } }))
  },
  cancel: cancelTaskNativeReminders,
  saved() {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('todoer:tasks-changed'))
  },
}

function mutateTask<T>(id: string, operation: () => Promise<T>) {
  return runTaskMutation(id, operation, mutationLifecycle)
}

function invalidateTasks(client: QueryClient) {
  return Promise.all([
    client.invalidateQueries({ queryKey: ['tasks'] }),
    client.invalidateQueries({ queryKey: ['subtasks'] }),
  ])
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Could not save. Please refresh and try again.'
}

async function requireCurrentAccount(userId: string | undefined) {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  if (!userId || data.session?.user.id !== userId) throw new Error('Sign in to the same account before retrying this change.')
}

async function copyLocalReminder(source: Task, next: Task, userId: string | undefined) {
  if (!userId || source.user_id !== userId) return
  try {
    await requireCurrentAccount(userId)
    const preference = getTaskReminderPreference(userId, source.id)
    if (preference.enabled) setTaskReminderPreference(userId, next.id, { ...preference, snoozeUntil: null })
  } catch (error) {
    toast.error('Next task saved, but its reminder could not be set.', { description: errorMessage(error) })
  }
}

export function useTasks(filters?: {
  projectId?: string
  labelId?: string
  isCompleted?: boolean
  dueDateRange?: { from: string; to: string }
  parentId?: string | null
  inbox?: boolean
}) {
  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: async () => {
      let query = supabase
        .from('tasks')
        .select('*, project:projects(*), section:sections(*)')
        .eq('is_deleted', false)
        .is('parent_id', null) // Only top-level tasks
        .order('position', { ascending: true })

      if (filters?.isCompleted !== undefined) {
        query = query.eq('is_completed', filters.isCompleted)
      }

      if (filters?.projectId) {
        query = query.eq('project_id', filters.projectId)
      }

      if (filters?.inbox) {
        query = query.is('project_id', null)
      }

      if (filters?.dueDateRange) {
        query = query
          .gte('due_date', filters.dueDateRange.from)
          .lte('due_date', filters.dueDateRange.to)
      }

      const { data, error } = await query
      if (error) throw error
      return data as (Task & { project: any; section: any })[]
    },
  })
}

export function useTasksByDate(date: string) {
  return useQuery({
    queryKey: ['tasks', 'date', date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, project:projects(*)')
        .eq('is_deleted', false)
        .eq('is_completed', false)
        .is('parent_id', null)
        .eq('due_date', date)
        .order('due_time', { ascending: true, nullsFirst: false })
        .order('priority', { ascending: false })
        .order('position', { ascending: true })

      if (error) throw error
      return (data || []) as (Task & { project: Project | null })[]
    },
  })
}

export function useTodayTasks() {
  const today = useLocalDate()
  return useQuery({
    queryKey: ['tasks', 'today', today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, project:projects(*)')
        .eq('is_deleted', false)
        .eq('is_completed', false)
        .is('parent_id', null)
        .lte('due_date', today)
        .order('due_date', { ascending: true })
        .order('due_time', { ascending: true, nullsFirst: false })
        .order('priority', { ascending: false })

      if (error) throw error
      return (data || []) as (Task & { project: Project | null })[]
    },
  })
}

export function useUpcomingTasks() {
  const today = useLocalDate()
  const end = new Date(`${today}T12:00:00`)
  end.setDate(end.getDate() + 7)
  const nextWeek = localDateKey(end)
  return useQuery({
    queryKey: ['tasks', 'upcoming', today, nextWeek],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, project:projects(*)')
        .eq('is_deleted', false)
        .eq('is_completed', false)
        .is('parent_id', null)
        .gte('due_date', today)
        .lte('due_date', nextWeek)
        .order('due_date', { ascending: true })
        .order('due_time', { ascending: true, nullsFirst: false })
        .order('priority', { ascending: false })

      if (error) throw error
      return (data || []) as (Task & { project: Project | null })[]
    },
  })
}

export function useSubtasks(parentId: string) {
  return useQuery({
    queryKey: ['subtasks', parentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('parent_id', parentId)
        .eq('is_deleted', false)
        .order('position', { ascending: true })

      if (error) throw error
      return (data || []) as Task[]
    },
    enabled: !!parentId,
  })
}

export function useCreateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (task: TaskInsert) => {
      const id = task.id ?? crypto.randomUUID()
      return mutateTask(id, () => taskRepository.insert({ ...task, id }))
    },
    onSettled: () => invalidateTasks(queryClient),
  })
}

export function useUpdateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (edit: TaskEdit) => mutateTask(edit.id, () => taskMutations.update(edit)),
    onSettled: () => invalidateTasks(queryClient),
  })
}

export function useCompleteTask() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  function showCompletion(completed: Task) {
    if (completed.recurrence_rule) {
      toast('Task completed', { description: `${completed.title}. Undo is unavailable for recurring tasks.` })
      return
    }
    toast('Task completed', {
      description: completed.title,
      action: {
        label: 'Undo',
        onClick: async () => {
          try {
            await requireCurrentAccount(user?.id)
            await mutateTask(completed.id, () => taskMutations.complete({ id: completed.id, isCompleted: false, expectedUpdatedAt: completed.updated_at }))
          } catch (error) { toast.error(errorMessage(error)) }
          finally { await invalidateTasks(queryClient) }
        },
      },
    })
  }

  function showRecurrenceRetry(error: RecurrenceInsertError) {
    const toastId = `recurrence-${error.completedTask.id}`
    toast.error('Task completed; next task still needs saving', {
      id: toastId,
      description: 'Keep this page open and retry to confirm the next occurrence. Your completed task has been kept.',
      duration: Infinity,
      dismissible: false,
      action: {
        label: 'Retry next task',
        onClick: async event => {
          // Sonner dismisses action toasts synchronously unless this is prevented.
          event.preventDefault()
          toast.loading('Saving the next occurrence…', { id: toastId, action: undefined, dismissible: false })
          try {
            await requireCurrentAccount(user?.id)
            const next = await mutateTask(error.pending.nextTask.id, () => taskMutations.retryRecurrence(error.pending))
            await copyLocalReminder(error.completedTask, next, user?.id)
            toast.success('Next occurrence saved', { id: toastId, duration: 4000, action: undefined, dismissible: true })
          } catch (retryError) {
            toast.error(errorMessage(retryError))
            showRecurrenceRetry(error)
          } finally { await invalidateTasks(queryClient) }
        },
      },
    })
  }

  return useMutation({
    mutationFn: async (completion: TaskCompletion) => {
      const result = await mutateTask(completion.id, () => taskMutations.complete(completion))
      if (result.nextTask) await copyLocalReminder(result.task, result.nextTask, user?.id)
      if (result.changed && result.task.is_completed) showCompletion(result.task)
      return result.task
    },
    onError: error => { if (error instanceof RecurrenceInsertError) showRecurrenceRetry(error) },
    onSettled: () => invalidateTasks(queryClient),
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: (id: string) => mutateTask(id, () => taskMutations.remove(id)),
    onSuccess: deleted => {
      toast('Task deleted', {
        description: deleted.title,
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await requireCurrentAccount(user?.id)
              await mutateTask(deleted.id, () => taskMutations.restore(deleted))
            } catch (error) { toast.error(errorMessage(error)) }
            finally { await invalidateTasks(queryClient) }
          },
        },
      })
    },
    onSettled: () => invalidateTasks(queryClient),
  })
}

export function useReorderTasks() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (tasks: { id: string; position: number }[]) => {
      const results = await Promise.allSettled(tasks.map(task => mutateTask(task.id, () => taskMutations.update(task))))
      const failed = results.find(result => result.status === 'rejected')
      if (failed?.status === 'rejected') throw new Error(`Some task positions could not be saved. ${errorMessage(failed.reason)}`)
      return results.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])
    },
    onSettled: () => invalidateTasks(queryClient),
  })
}

export function useTaskLabels(taskId: string) {
  return useQuery({
    queryKey: ['task-labels', taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_labels')
        .select('label_id, labels(*)')
        .eq('task_id', taskId)

      if (error) throw error
      return data?.map(tl => (tl as any).labels) || []
    },
    enabled: !!taskId,
  })
}
