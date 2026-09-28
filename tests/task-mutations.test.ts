import { describe, expect, it, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseTaskRepository, createTaskMutations, runTaskMutation, RecurrenceInsertError, type TaskConditions, type TaskRepository } from '@/lib/task-mutations'
import type { Database, Task, TaskInsert, TaskUpdate } from '@/types/database'

const ORIGINAL_UPDATED = '2026-09-12T12:00:00.000Z'
const SAVED_AT = '2026-09-12T13:00:00.000Z'

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'original', user_id: 'owner', title: 'Water plants', description: 'Keep these notes',
    completed_at: null, created_at: ORIGINAL_UPDATED, updated_at: ORIGINAL_UPDATED, deleted_at: null,
    due_date: '2026-09-12', due_time: '09:30:00', start_date: null, start_time: null,
    duration_minutes: 15, is_completed: false, is_deleted: false, last_nag_at: null,
    nag_enabled: false, nag_interval: 300, parent_id: null, position: 2, priority: 2,
    project_id: 'shared-project', recurrence_rule: 'FREQ=DAILY', recurrence_type: 'due_date',
    reminder_enabled: false, section_id: 'section', snooze_until: null, ...overrides,
  }
}

/** Models row-level conditional writes; only the database boundary is replaced. */
class MemoryTasks implements TaskRepository {
  rows = new Map<string, Task>()
  failInsert: 'before' | 'after' | null = null
  failUpdate = false
  constructor(rows: Task[] = [task()]) { for (const row of rows) this.rows.set(row.id, { ...row }) }
  async get(id: string) { const row = this.rows.get(id); return row ? { ...row } : null }
  async update(id: string, patch: TaskUpdate, conditions: TaskConditions) {
    if (this.failUpdate) throw new Error('Save unavailable')
    const row = this.rows.get(id)
    if (!row || Object.entries(conditions).some(([key, value]) => row[key as keyof Task] !== value)) return null
    const saved = { ...row, ...patch }
    this.rows.set(id, saved)
    return { ...saved }
  }
  async insert(value: TaskInsert & { id: string }) {
    const failure = this.failInsert
    this.failInsert = null
    if (failure === 'before') throw new Error('Offline')
    if (this.rows.has(value.id)) throw Object.assign(new Error('Duplicate primary key'), { code: '23505' })
    const saved = task(value)
    this.rows.set(saved.id, saved)
    if (failure === 'after') throw new Error('Response timed out after commit')
    return { ...saved }
  }
}

function mutations(repo: MemoryTasks) {
  let sequence = 0
  return createTaskMutations(repo, { now: () => new Date(SAVED_AT), createId: () => `next-${++sequence}` })
}

async function pendingCompletion(repo: MemoryTasks, failure: 'before' | 'after') {
  const service = mutations(repo)
  repo.failInsert = failure
  try {
    await service.complete({ id: 'original', isCompleted: true })
    throw new Error('Expected successor insertion failure')
  } catch (error) {
    expect(error).toBeInstanceOf(RecurrenceInsertError)
    return { service, error: error as RecurrenceInsertError }
  }
}

describe('task mutation reliability', () => {
  it.each([
    'FREQ=DAILY;COUNT=3',
    'FREQ=DAILY;UNTIL=20260930T000000Z',
    'FREQ=DAILY;INTERVAL=2x',
    'FREQ=WEEKLY;BYDAY=ZZ',
    'FREQ=MONTHLY;BYMONTHDAY=15x',
    'FREQ=MONTHLY;BYSETPOS=1',
  ])('rejects %s before making any completion or successor write', async rule => {
    const original = task({ recurrence_rule: rule })
    const repo = new MemoryTasks([original])
    const update = vi.spyOn(repo, 'update')
    const insert = vi.spyOn(repo, 'insert')
    await expect(mutations(repo).complete({ id: original.id, isCompleted: true })).rejects.toThrow(/repeat|schedule/i)
    expect(update).not.toHaveBeenCalled()
    expect(insert).not.toHaveBeenCalled()
    expect([...repo.rows.values()]).toEqual([original])
  })

  it('allows only one concurrent completion caller to create the next occurrence', async () => {
    const repo = new MemoryTasks()
    const first = mutations(repo)
    const second = mutations(repo)
    const results = await Promise.all([
      first.complete({ id: 'original', isCompleted: true }),
      second.complete({ id: 'original', isCompleted: true }),
    ])
    expect(results.filter(result => result.changed)).toHaveLength(1)
    expect([...repo.rows.values()].filter(row => !row.is_completed)).toHaveLength(1)
    expect(repo.rows.get('original')?.completed_at).toBe(SAVED_AT)
    await first.complete({ id: 'original', isCompleted: true })
    expect(repo.rows.size).toBe(2)
  })

  it('preserves the task content, ownership and schedule when creating a successor', async () => {
    const repo = new MemoryTasks()
    const result = await mutations(repo).complete({ id: 'original', isCompleted: true })
    expect(result.nextTask).toMatchObject({
      id: 'next-1', user_id: 'owner', title: 'Water plants', description: 'Keep these notes',
      due_date: '2026-09-13', due_time: '09:30:00', project_id: 'shared-project',
      section_id: 'section', priority: 2, duration_minutes: 15, position: 2,
      recurrence_rule: 'FREQ=DAILY', is_completed: false, completed_at: null,
    })
    expect(repo.rows.get('original')?.description).toBe('Keep these notes')
  })

  it('keeps a successful completion when insertion fails and retries the same successor', async () => {
    const repo = new MemoryTasks()
    const { service, error } = await pendingCompletion(repo, 'before')
    expect(repo.rows.get('original')?.is_completed).toBe(true)
    expect(error.completedTask.is_completed).toBe(true)
    expect(repo.rows.size).toBe(1)
    const retried = await service.retryRecurrence(error.pending)
    expect(retried.id).toBe('next-1')
    const retriedAgain = await service.retryRecurrence(error.pending)
    expect(retriedAgain.id).toBe('next-1')
    expect(repo.rows.size).toBe(2)
  })

  it('recovers an insert timeout by verifying the exact row with the fixed ID', async () => {
    const repo = new MemoryTasks()
    const { service, error } = await pendingCompletion(repo, 'after')
    expect(repo.rows.size).toBe(2)
    const saved = await service.retryRecurrence(error.pending)
    expect(saved.id).toBe('next-1')
    expect(repo.rows.size).toBe(2)
  })

  it('does not treat an unrelated row with a colliding ID as the inserted successor', async () => {
    const repo = new MemoryTasks()
    const { service, error } = await pendingCompletion(repo, 'before')
    repo.rows.set('next-1', task({ id: 'next-1', user_id: 'another-owner', description: 'Unrelated' }))
    await expect(service.retryRecurrence(error.pending)).rejects.toThrow(/verify|different|conflict/i)
    expect(repo.rows.get('next-1')?.description).toBe('Unrelated')
  })

  it('refuses recurring undo without touching other tasks with the same title', async () => {
    const repo = new MemoryTasks([
      task({ is_completed: true, completed_at: SAVED_AT }),
      task({ id: 'unrelated', description: 'An unrelated task with the same title' }),
    ])
    await expect(mutations(repo).complete({ id: 'original', isCompleted: false })).rejects.toThrow(/recurring.*undo|undo.*recurring/i)
    expect(repo.rows.get('original')?.is_completed).toBe(true)
    expect(repo.rows.get('unrelated')?.is_deleted).toBe(false)
    expect(repo.rows.size).toBe(2)
  })

  it('undoes only a nonrecurring completion and returns the actual saved row', async () => {
    const repo = new MemoryTasks([task({ recurrence_rule: null, is_completed: true, completed_at: ORIGINAL_UPDATED })])
    const result = await mutations(repo).complete({ id: 'original', isCompleted: false, expectedUpdatedAt: ORIGINAL_UPDATED })
    expect(result.task).toMatchObject({ is_completed: false, completed_at: null, updated_at: SAVED_AT })
    expect(repo.rows.size).toBe(1)
  })

  it('does not overwrite a newer edit or complete a changed task from a stale detail view', async () => {
    const repo = new MemoryTasks([task({ title: 'Partner changed this', updated_at: '2026-09-12T12:30:00.000Z' })])
    const service = mutations(repo)
    await expect(service.update({ id: 'original', title: 'Stale title', expectedUpdatedAt: ORIGINAL_UPDATED })).rejects.toThrow(/changed|conflict/i)
    await expect(service.complete({ id: 'original', isCompleted: true, expectedUpdatedAt: ORIGINAL_UPDATED })).rejects.toThrow(/changed|conflict/i)
    expect(repo.rows.get('original')).toMatchObject({ title: 'Partner changed this', is_completed: false })
    expect(repo.rows.size).toBe(1)
  })

  it('supports a null expected revision and records the timestamp of the saved edit', async () => {
    const repo = new MemoryTasks([task({ updated_at: null })])
    const saved = await mutations(repo).update({ id: 'original', title: 'Saved title', expectedUpdatedAt: null })
    expect(saved.title).toBe('Saved title')
    expect(saved.updated_at).toBe(SAVED_AT)
    await expect(mutations(repo).update({ id: 'original', description: 'Stale', expectedUpdatedAt: null })).rejects.toThrow(/changed|conflict/i)
    expect(repo.rows.get('original')?.description).toBe('Keep these notes')
  })

  it('reports an edit failure without mutating the stored task', async () => {
    const repo = new MemoryTasks()
    repo.failUpdate = true
    await expect(mutations(repo).update({ id: 'original', title: 'Unsaved' })).rejects.toThrow('Save unavailable')
    expect(repo.rows.get('original')?.title).toBe('Water plants')
  })

  it('reports zero-row deletes and failed deletes instead of reporting success', async () => {
    const repo = new MemoryTasks()
    const service = mutations(repo)
    await expect(service.remove('missing')).rejects.toThrow(/unavailable|changed|access/i)
    repo.failUpdate = true
    await expect(service.remove('original')).rejects.toThrow('Save unavailable')
    expect(repo.rows.get('original')?.is_deleted).toBe(false)
  })

  it('returns the deleted row and refuses an undo that would overwrite a later change', async () => {
    const repo = new MemoryTasks()
    const service = mutations(repo)
    const deleted = await service.remove('original')
    expect(deleted).toMatchObject({ id: 'original', title: 'Water plants', is_deleted: true, deleted_at: SAVED_AT })
    repo.rows.set('original', { ...deleted, updated_at: '2026-09-12T14:00:00.000Z' })
    await expect(service.restore(deleted)).rejects.toThrow(/changed|conflict/i)
    expect(repo.rows.get('original')?.is_deleted).toBe(true)
  })

  it('restores only the deleted row with its original content intact', async () => {
    const repo = new MemoryTasks()
    const service = mutations(repo)
    const deleted = await service.remove('original')
    const restored = await service.restore(deleted)
    expect(restored).toMatchObject({ id: 'original', description: 'Keep these notes', is_deleted: false, deleted_at: null })
  })
})

describe('mutation reminder lifecycle', () => {
  it('awaits native cancellation before saving, then announces the save before settling', async () => {
    const events: string[] = []
    let finishCancellation!: () => void
    const cancellation = new Promise<void>(resolve => { finishCancellation = resolve })
    const result = runTaskMutation('original', async () => { events.push('write'); return 'saved-row' }, {
      phase: (id, phase) => { events.push(`${id}:${phase}`) },
      cancel: async () => { events.push('cancel'); await cancellation },
      saved: () => { events.push('saved') },
    })
    expect(events).toEqual(['original:start', 'cancel'])
    finishCancellation()
    expect(await result).toBe('saved-row')
    expect(events).toEqual(['original:start', 'cancel', 'write', 'saved', 'original:settled'])
  })

  it('does not write when native cancellation fails and always settles the task', async () => {
    const events: string[] = []
    await expect(runTaskMutation('original', async () => { events.push('write') }, {
      phase: (_id, phase) => { events.push(phase) },
      cancel: async () => { throw new Error('Could not cancel reminders') },
      saved: () => { events.push('saved') },
    })).rejects.toThrow('Could not cancel reminders')
    expect(events).toEqual(['start', 'settled'])
  })

  it('announces a partial completion as changed even when successor insertion fails', async () => {
    const repo = new MemoryTasks()
    repo.failInsert = 'before'
    const events: string[] = []
    await expect(runTaskMutation('original', () => mutations(repo).complete({ id: 'original', isCompleted: true }), {
      phase: (_id, phase) => { events.push(phase) }, cancel: async () => {},
      saved: () => { events.push('saved') },
    })).rejects.toBeInstanceOf(RecurrenceInsertError)
    expect(events).toEqual(['start', 'saved', 'settled'])
  })
})

describe('Supabase mutation adapter', () => {
  it('sends the completion predicate and SQL null revision and recognizes zero updated rows', async () => {
    let requestUrl: URL | undefined
    let requestBody: unknown
    const client = createClient<Database>('https://test.supabase.co', 'test-public-key', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async (input, init) => {
        requestUrl = new URL(String(input))
        requestBody = JSON.parse(String(init?.body))
        return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })
      } },
    })
    const saved = await createSupabaseTaskRepository(client).update('original', { is_completed: true, updated_at: SAVED_AT }, {
      is_completed: false, is_deleted: false, updated_at: null,
    })
    expect(saved).toBeNull()
    expect(requestUrl?.searchParams.get('id')).toBe('eq.original')
    expect(requestUrl?.searchParams.get('is_completed')).toBe('eq.false')
    expect(requestUrl?.searchParams.get('is_deleted')).toBe('eq.false')
    expect(requestUrl?.searchParams.get('updated_at')).toBe('is.null')
    expect(requestBody).toEqual({ is_completed: true, updated_at: SAVED_AT })
  })
})
