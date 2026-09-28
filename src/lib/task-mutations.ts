import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Task, TaskInsert, TaskUpdate } from '@/types/database'
import { calculateNextDueDate } from '@/lib/recurrence'

export type TaskConditions = Partial<Pick<Task, 'is_completed' | 'is_deleted' | 'updated_at' | 'recurrence_rule'>>
export interface TaskRepository {
  get(id: string): Promise<Task | null>
  update(id: string, patch: TaskUpdate, conditions: TaskConditions): Promise<Task | null>
  insert(task: TaskInsert & { id: string }): Promise<Task>
}

export function createSupabaseTaskRepository(client: SupabaseClient<Database>): TaskRepository {
  return {
    async get(id) {
      const { data, error } = await client.from('tasks').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      return data as Task | null
    },
    async update(id, patch, conditions) {
      let query = client.from('tasks').update(patch).eq('id', id)
      for (const [column, value] of Object.entries(conditions)) {
        query = value === null ? query.is(column, null) : query.eq(column, value)
      }
      const { data, error } = await query.select('*')
      if (error) throw error
      return (data?.[0] as Task | undefined) ?? null
    },
    async insert(task) {
      const { data, error } = await client.from('tasks').insert(task).select('*').single()
      if (error) throw error
      if (!data) throw new Error('The task could not be saved. Please try again.')
      return data as Task
    },
  }
}

export type TaskEdit = TaskUpdate & { id: string; expectedUpdatedAt?: string | null }
export interface TaskCompletion { id: string; isCompleted: boolean; expectedUpdatedAt?: string | null }
export interface CompletionResult { task: Task; changed: boolean; nextTask?: Task }
export interface PendingRecurrence { sourceId: string; nextTask: TaskInsert & { id: string } }

export class TaskConflictError extends Error {
  constructor() { super('This task changed or is no longer available. Refresh and review it before trying again.'); this.name = 'TaskConflictError' }
}

export class RecurrenceInsertError extends Error {
  constructor(public completedTask: Task, public pending: PendingRecurrence, public cause: unknown) {
    super('Task completed, but the next occurrence could not be confirmed. Use Retry next task to finish saving it. Keep this page open until the retry succeeds.')
    this.name = 'RecurrenceInsertError'
  }
}

export async function runTaskMutation<T>(id: string, operation: () => Promise<T>, lifecycle: {
  phase: (id: string, phase: 'start' | 'settled') => void
  cancel: (id: string) => Promise<void>
  saved: () => void
}): Promise<T> {
  lifecycle.phase(id, 'start')
  try {
    await lifecycle.cancel(id)
    const result = await operation()
    lifecycle.saved()
    return result
  } catch (error) {
    if (error instanceof RecurrenceInsertError) lifecycle.saved()
    throw error
  } finally {
    lifecycle.phase(id, 'settled')
  }
}

/**
 * Conditional completion prevents two callers from spawning successors. Completion
 * and insertion are still separate writes: only the winner owns the retry payload.
 * This is not a transaction or a durable offline queue. Recurring undo needs a
 * database occurrence link and transaction before it can be implemented safely.
 */
export function createTaskMutations(repository: TaskRepository, options: { now?: () => Date; createId?: () => string } = {}) {
  const now = options.now ?? (() => new Date())
  const createId = options.createId ?? (() => crypto.randomUUID())
  const timestamp = (previous?: string | null) => {
    const prior = previous ? Date.parse(previous) : NaN
    return new Date(Math.max(now().getTime(), Number.isFinite(prior) ? prior + 1 : 0)).toISOString()
  }

  async function requireTask(id: string) {
    const task = await repository.get(id)
    if (!task || task.is_deleted) throw new TaskConflictError()
    return task
  }

  async function update({ id, expectedUpdatedAt, ...patch }: TaskEdit) {
    const saved = await repository.update(id, { ...patch, updated_at: timestamp(expectedUpdatedAt) }, {
      is_deleted: false,
      ...(expectedUpdatedAt !== undefined ? { updated_at: expectedUpdatedAt } : {}),
    })
    if (!saved) throw new TaskConflictError()
    return saved
  }

  async function retryRecurrence(pending: PendingRecurrence): Promise<Task> {
    try {
      return await repository.insert(pending.nextTask)
    } catch (error) {
      // A timed-out insert can already exist. Retry the same primary key; never
      // choose a replacement ID or identify an occurrence by its title.
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
        const existing = await repository.get(pending.nextTask.id)
        if (existing && Object.entries(pending.nextTask).every(([key, value]) => existing[key as keyof Task] === value)) return existing
        throw new Error('Could not verify the next occurrence: that ID contains a different task or the task changed. Refresh and review it.')
      }
      throw error
    }
  }

  async function complete({ id, isCompleted, expectedUpdatedAt }: TaskCompletion): Promise<CompletionResult> {
    const current = await requireTask(id)
    if (!isCompleted && current.recurrence_rule) {
      throw new Error('Undo is unavailable for recurring tasks until completion and the next occurrence can be changed together safely.')
    }
    if (expectedUpdatedAt !== undefined && current.updated_at !== expectedUpdatedAt) throw new TaskConflictError()
    if (current.is_completed === isCompleted) return { task: current, changed: false }

    // Compute the schedule before completing; a bad rule must not strand the task.
    const nextDueDate = isCompleted && current.recurrence_rule
      ? calculateNextDueDate(current.recurrence_rule, current.due_date, current.recurrence_type, now())
      : null
    const savedAt = timestamp(current.updated_at)
    const completed = await repository.update(id, {
      is_completed: isCompleted, completed_at: isCompleted ? savedAt : null, updated_at: savedAt,
    }, {
      is_completed: !isCompleted, is_deleted: false,
      updated_at: current.updated_at, recurrence_rule: current.recurrence_rule,
    })
    if (!completed) {
      const latest = await requireTask(id)
      if (latest.is_completed === isCompleted && expectedUpdatedAt === undefined) return { task: latest, changed: false }
      throw new TaskConflictError()
    }

    if (!isCompleted || !completed.recurrence_rule) return { task: completed, changed: true }
    const pending: PendingRecurrence = {
      sourceId: id,
      nextTask: {
        id: createId(), user_id: completed.user_id, title: completed.title,
        description: completed.description, priority: completed.priority,
        project_id: completed.project_id, section_id: completed.section_id, parent_id: completed.parent_id,
        due_date: nextDueDate, due_time: completed.due_time,
        start_date: completed.start_date, start_time: completed.start_time, duration_minutes: completed.duration_minutes,
        recurrence_rule: completed.recurrence_rule, recurrence_type: completed.recurrence_type,
        nag_enabled: completed.nag_enabled, nag_interval: completed.nag_interval, reminder_enabled: completed.reminder_enabled,
        position: completed.position, is_completed: false, completed_at: null, is_deleted: false,
      },
    }
    try {
      return { task: completed, changed: true, nextTask: await retryRecurrence(pending) }
    } catch (error) {
      throw new RecurrenceInsertError(completed, pending, error)
    }
  }

  async function remove(id: string) {
    const savedAt = timestamp()
    const saved = await repository.update(id, { is_deleted: true, deleted_at: savedAt, updated_at: savedAt }, { is_deleted: false })
    if (!saved) throw new TaskConflictError()
    return saved
  }

  async function restore(deleted: Task) {
    const saved = await repository.update(deleted.id, { is_deleted: false, deleted_at: null, updated_at: timestamp(deleted.updated_at) }, {
      is_deleted: true, updated_at: deleted.updated_at,
    })
    if (!saved) throw new TaskConflictError()
    return saved
  }

  return { update, complete, retryRecurrence, remove, restore }
}
