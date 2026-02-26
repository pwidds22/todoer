'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Task, TaskInsert, TaskUpdate, Project } from '@/types/database'
import { calculateNextDueDate } from '@/lib/recurrence'
import { toast } from 'sonner'

const supabase = createClient()

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
  const today = new Date().toISOString().split('T')[0]
  return useQuery({
    queryKey: ['tasks', 'today'],
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
  const today = new Date().toISOString().split('T')[0]
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  return useQuery({
    queryKey: ['tasks', 'upcoming'],
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
      const { data, error } = await supabase
        .from('tasks')
        .insert(task)
        .select()
        .single()

      if (error) throw error
      return data as Task
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export function useUpdateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: TaskUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as Task
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['subtasks'] })
    },
  })
}

export function useCompleteTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, isCompleted }: { id: string; isCompleted: boolean }) => {
      // Complete (or uncomplete) the current task.
      const { data, error } = await supabase
        .from('tasks')
        .update({
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null,
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      const completedTask = data as Task

      // If we are completing a recurring task, create the next occurrence.
      if (isCompleted && completedTask.recurrence_rule) {
        const nextDueDate = calculateNextDueDate(
          completedTask.recurrence_rule,
          completedTask.due_date,
          completedTask.recurrence_type
        )

        const nextTask: TaskInsert = {
          user_id: completedTask.user_id,
          title: completedTask.title,
          description: completedTask.description,
          priority: completedTask.priority,
          project_id: completedTask.project_id,
          section_id: completedTask.section_id,
          parent_id: completedTask.parent_id,
          due_date: nextDueDate,
          due_time: completedTask.due_time,
          start_date: completedTask.start_date,
          start_time: completedTask.start_time,
          duration_minutes: completedTask.duration_minutes,
          recurrence_rule: completedTask.recurrence_rule,
          recurrence_type: completedTask.recurrence_type,
          nag_enabled: completedTask.nag_enabled,
          nag_interval: completedTask.nag_interval,
          reminder_enabled: completedTask.reminder_enabled,
          position: completedTask.position,
          is_completed: false,
          completed_at: null,
          is_deleted: false,
        }

        const { error: insertError } = await supabase
          .from('tasks')
          .insert(nextTask)

        if (insertError) throw insertError
      }

      return completedTask
    },
    onSuccess: (completedTask) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['subtasks'] })

      // Show undo toast when completing (not uncompleting)
      if (completedTask.is_completed) {
        toast(`Task completed`, {
          description: completedTask.title,
          action: {
            label: 'Undo',
            onClick: async () => {
              // If a recurring task spawned a next occurrence, delete it
              if (completedTask.recurrence_rule) {
                const { data: nextTasks } = await supabase
                  .from('tasks')
                  .select('id')
                  .eq('title', completedTask.title)
                  .eq('is_completed', false)
                  .eq('is_deleted', false)
                  .neq('id', completedTask.id)
                  .order('created_at', { ascending: false })
                  .limit(1)
                if (nextTasks && nextTasks.length > 0) {
                  await supabase.from('tasks').update({ is_deleted: true }).eq('id', nextTasks[0].id)
                }
              }
              await supabase.from('tasks').update({ is_completed: false, completed_at: null }).eq('id', completedTask.id)
              queryClient.invalidateQueries({ queryKey: ['tasks'] })
              queryClient.invalidateQueries({ queryKey: ['subtasks'] })
            },
          },
        })
      }
    },
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      // Fetch the task first so we can show its title and undo
      const { data: taskData } = await supabase.from('tasks').select('title').eq('id', id).single()

      const { error } = await supabase
        .from('tasks')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error
      return { id, title: (taskData as any)?.title || 'Task' }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })

      toast('Task deleted', {
        description: result.title,
        action: {
          label: 'Undo',
          onClick: async () => {
            await supabase.from('tasks').update({ is_deleted: false, deleted_at: null }).eq('id', result.id)
            queryClient.invalidateQueries({ queryKey: ['tasks'] })
          },
        },
      })
    },
  })
}

export function useReorderTasks() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (tasks: { id: string; position: number }[]) => {
      // Update positions in batch
      const updates = tasks.map(({ id, position }) =>
        supabase.from('tasks').update({ position }).eq('id', id)
      )
      await Promise.all(updates)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
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
