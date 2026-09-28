import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Task } from '@/types/database'
import type { PlannedReminder } from '@/lib/reminders/planner'

type ReadResult = { data: Task[] | null; error: { message: string } | null }
type PendingRead = { resolve: (result: ReadResult) => void }

// Replace the external database, device and React mounting boundary. The effect,
// event handlers, planner, preference store and receipt parsing stay real.
const runtime = vi.hoisted(() => {
  const state = {
    effects: [] as Array<() => void | (() => void)>,
    reads: [] as PendingRead[],
    nativePlan: [] as PlannedReminder[],
    nativeHistory: [] as PlannedReminder[][],
    isNative: false,
    platform: 'android',
    ownedOneShotIds: [] as number[],
    nativeWait: null as Promise<void> | null,
  }
  const notify = Object.assign(vi.fn(), { dismiss: vi.fn(), error: vi.fn() })
  const native = {
    activateReminderAccount: vi.fn(),
    cancelTaskNativeReminders: vi.fn(async (taskId: string) => {
      state.nativePlan = state.nativePlan.filter(item => item.taskId !== taskId)
    }),
    syncNativeReminders: vi.fn(async (_userId: string, build: (consumed: Set<number>) => PlannedReminder[]) => {
      state.nativePlan = build(new Set())
      state.nativeHistory.push(state.nativePlan)
      if (state.nativeWait) await state.nativeWait
      return { ownedOneShotIds: state.ownedOneShotIds }
    }),
    listenForReminderActions: vi.fn(async () => ({ remove: vi.fn(async () => {}) })),
    reportReminderStatus: vi.fn(),
  }
  const client = {
    from: () => {
      let resolve!: (result: ReadResult) => void
      const promise = new Promise<ReadResult>(done => { resolve = done })
      state.reads.push({ resolve })
      const query = { select: () => query, eq: () => query, then: promise.then.bind(promise) }
      return query
    },
  }
  return { state, notify, native, client, complete: vi.fn(), selectTask: vi.fn() }
})

vi.mock('react', () => ({
  useEffect: (effect: () => void | (() => void)) => { runtime.state.effects.push(effect) },
  useRef: (value: unknown) => ({ current: value }),
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => runtime.client }))
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }))
vi.mock('@/hooks/useTasks', () => ({ useCompleteTask: () => ({ mutate: runtime.complete }) }))
vi.mock('@/stores/ui-store', () => ({ useUIStore: { getState: () => ({ selectTask: runtime.selectTask }) } }))
vi.mock('sonner', () => ({ toast: runtime.notify }))
vi.mock('@/lib/reminders/native', () => runtime.native)
vi.mock('@/lib/native/platform', () => ({ isNative: () => runtime.state.isNative }))
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => runtime.state.isNative ? runtime.state.platform : 'web' } }))

import { NagReminder } from '@/components/NagReminder'
import { setReminderSettings, setTaskReminderPreference } from '@/lib/reminders/preferences'
import { createFocusState, saveFocusState, transitionFocusTimer } from '@/lib/focus-timer'
import { planReminders } from '@/lib/reminders/planner'

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-a', user_id: 'owner', title: 'Call dentist', description: null,
    due_date: '2026-09-12', due_time: '10:00:00', start_date: null, start_time: null,
    is_completed: false, is_deleted: false, completed_at: null, deleted_at: null,
    created_at: '2026-09-12T09:00:00.000Z', updated_at: '2026-09-12T09:00:00.000Z',
    duration_minutes: null, last_nag_at: null, nag_enabled: false, nag_interval: null,
    parent_id: null, position: 0, priority: 0, project_id: null, recurrence_rule: null,
    recurrence_type: null, reminder_enabled: false, section_id: null, snooze_until: null,
    ...overrides,
  }
}

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

let windowEvents: EventTarget
let documentEvents: EventTarget & { visibilityState: string }
let cleanups: Array<() => void>

function mountRuntime() {
  NagReminder()
  const effect = runtime.state.effects.pop()
  if (!effect) throw new Error('Reminder effect did not mount')
  const dispose = effect()
  if (typeof dispose !== 'function') throw new Error('Reminder effect did not install cleanup')
  cleanups.push(dispose)
  return () => {
    dispose()
    cleanups = cleanups.filter(cleanup => cleanup !== dispose)
  }
}

function latestRead() {
  const read = runtime.state.reads.at(-1)
  if (!read) throw new Error('Expected an authoritative task refresh')
  return read
}

async function resolveRead(read: PendingRead, rows: Task[], error: ReadResult['error'] = null) {
  read.resolve({ data: error ? null : rows, error })
  await vi.advanceTimersByTimeAsync(0)
}

function mutation(phase: 'start' | 'settled', id = 'task-a') {
  const event = new Event('todoer:task-mutation')
  Object.assign(event, { detail: { id, phase } })
  windowEvents.dispatchEvent(event)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-12T10:00:00'))
  runtime.state.effects = []
  runtime.state.reads = []
  runtime.state.nativePlan = []
  runtime.state.nativeHistory = []
  runtime.state.isNative = false
  runtime.state.platform = 'android'
  runtime.state.ownedOneShotIds = []
  runtime.state.nativeWait = null
  cleanups = []
  const storage = new MemoryStorage()
  windowEvents = Object.assign(new EventTarget(), { localStorage: storage, focus: vi.fn() })
  documentEvents = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  vi.stubGlobal('window', windowEvents)
  vi.stubGlobal('document', documentEvents)
  vi.stubGlobal('localStorage', storage)
  setReminderSettings('owner', { quietEnabled: false })
  setTaskReminderPreference('owner', 'task-a', { enabled: true, mode: 'persistent', intervalSeconds: 60 })
})

afterEach(() => {
  for (const cleanup of cleanups) cleanup()
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('reminder runtime refresh and mutation ordering', () => {
  it.each(['completion', 'edit'] as const)('does not requeue stale reminders during a %s refresh', async operation => {
    mountRuntime()
    await resolveRead(latestRead(), [task()])
    expect(runtime.state.nativePlan.some(item => item.taskId === 'task-a')).toBe(true)

    mutation('start')
    expect(runtime.state.nativePlan).toEqual([])
    mutation('settled')
    const settledRefresh = latestRead()
    setReminderSettings('owner', { sound: true })
    const settingsRefresh = latestRead()
    documentEvents.dispatchEvent(new Event('visibilitychange'))
    const visibleRefresh = latestRead()
    expect(runtime.state.nativePlan).toEqual([])

    // Both requests began before the latest visibility refresh. Their old result
    // must not release the task from cancellation or supersede newer task data.
    await resolveRead(settledRefresh, [task()])
    await resolveRead(settingsRefresh, [task()])
    await vi.advanceTimersByTimeAsync(2000)
    expect(runtime.state.nativePlan).toEqual([])
    expect(runtime.notify).not.toHaveBeenCalled()

    const authoritative = operation === 'completion' ? [] : [task({ title: 'Call the new dentist', due_time: '11:00:00' })]
    await resolveRead(visibleRefresh, authoritative)
    if (operation === 'completion') {
      expect(runtime.state.nativePlan).toEqual([])
    } else {
      expect(runtime.state.nativePlan.length).toBeGreaterThan(0)
      expect(runtime.state.nativePlan.every(item => item.title === 'Call the new dentist')).toBe(true)
      expect(runtime.state.nativePlan[0].at).toBe(new Date('2026-09-12T11:00:00').getTime())
    }
    await vi.advanceTimersByTimeAsync(1000)
    expect(runtime.notify).not.toHaveBeenCalled()
  })

  it('keeps the task canceled until every overlapping mutation settles', async () => {
    mountRuntime()
    await resolveRead(latestRead(), [task()])
    mutation('start')
    mutation('start')
    mutation('settled')
    await resolveRead(latestRead(), [task()])
    windowEvents.dispatchEvent(new Event('focus'))
    await resolveRead(latestRead(), [task()])
    await vi.advanceTimersByTimeAsync(2000)
    expect(runtime.state.nativePlan).toEqual([])
    expect(runtime.notify).not.toHaveBeenCalled()

    // Failed saves may leave the task unchanged. Resume reminders only after
    // the last operation settled and a successful read confirms that fact.
    mutation('settled')
    expect(runtime.state.nativePlan).toEqual([])
    await resolveRead(latestRead(), [task()])
    expect(runtime.state.nativePlan.length).toBeGreaterThan(0)
    await vi.advanceTimersByTimeAsync(1000)
    expect(runtime.notify).toHaveBeenCalledTimes(1)
    expect(runtime.notify.mock.calls[0][0]).toBe('Call dentist')
  })

  it('retains cancellation after a failed refresh and resumes after confirmed recovery', async () => {
    mountRuntime()
    await resolveRead(latestRead(), [task()])
    mutation('start')
    mutation('settled')
    await resolveRead(latestRead(), [], { message: 'Network unavailable' })
    setReminderSettings('owner', { sound: true })
    const retryRefresh = latestRead()
    await vi.advanceTimersByTimeAsync(2000)
    expect(runtime.state.nativePlan).toEqual([])
    expect(runtime.notify).not.toHaveBeenCalled()

    await resolveRead(retryRefresh, [task()])
    await vi.advanceTimersByTimeAsync(1000)
    expect(runtime.notify).toHaveBeenCalledTimes(1)
    expect(runtime.state.nativePlan.length).toBeGreaterThan(0)
  })
})

describe('reminder runtime delivery receipts and quiet time', () => {
  it.each([
    { platform: 'ios', secondOffset: 60_000 },
    { platform: 'android', secondOffset: 600_000 },
  ])('uses the $platform native floor in the actual reminder runtime', async ({ platform, secondOffset }) => {
    runtime.state.isNative = true
    runtime.state.platform = platform
    const now = Date.now()
    mountRuntime()
    await resolveRead(latestRead(), [task()])
    expect(runtime.state.nativePlan[1].at - now).toBe(secondOffset)
    expect(runtime.state.nativePlan).toHaveLength(32)
  })

  it('does not show another one-shot toast after native background delivery and reopening', async () => {
    runtime.state.isNative = true
    setTaskReminderPreference('owner', 'task-a', { enabled: true, mode: 'once', intervalSeconds: 60 })
    const reminder = planReminders([{ ...task(), preference: { enabled: true, mode: 'once', intervalSeconds: 60 } }], {
      now: Date.now(), settings: { quietEnabled: false, quietStart: '22:00', quietEnd: '07:00' },
    })[0]
    runtime.state.ownedOneShotIds = [reminder.id]
    vi.setSystemTime(new Date('2026-09-12T10:05:00'))
    mountRuntime()
    await resolveRead(latestRead(), [task()])
    await vi.advanceTimersByTimeAsync(2000)
    expect(runtime.notify).not.toHaveBeenCalled()
  })

  it('waits for native ownership before choosing one-shot delivery and keeps permission-off fallback', async () => {
    runtime.state.isNative = true
    setTaskReminderPreference('owner', 'task-a', { enabled: true, mode: 'once', intervalSeconds: 60 })
    let release!: () => void
    runtime.state.nativeWait = new Promise<void>(resolve => { release = resolve })
    mountRuntime()
    await resolveRead(latestRead(), [task()])
    await vi.advanceTimersByTimeAsync(2000)
    expect(runtime.notify).not.toHaveBeenCalled()
    // Permission off means the native scheduler returns no ownership.
    release()
    await vi.advanceTimersByTimeAsync(1000)
    expect(runtime.notify).toHaveBeenCalledTimes(1)
  })

  it('does not hold shared-list foreground one-shots while native synchronization is waiting', async () => {
    runtime.state.isNative = true
    runtime.state.nativeWait = new Promise<void>(() => {})
    setTaskReminderPreference('owner', 'task-a', { enabled: true, mode: 'once', intervalSeconds: 60 })
    mountRuntime()
    await resolveRead(latestRead(), [task({ project_id: 'shared-list' })])
    await vi.advanceTimersByTimeAsync(1000)
    expect(runtime.notify).toHaveBeenCalledTimes(1)
  })

  it('does not repeat a once reminder after focus reconfiguration or a later reload', async () => {
    setTaskReminderPreference('owner', 'task-a', { enabled: true, mode: 'once', intervalSeconds: 60 })
    const dispose = mountRuntime()
    await resolveRead(latestRead(), [task()])
    await vi.advanceTimersByTimeAsync(1000)
    expect(runtime.notify).toHaveBeenCalledTimes(1)

    let focus = transitionFocusTimer(createFocusState('focus-1'), { type: 'task', taskId: 'task-a' }, Date.now())
    focus = transitionFocusTimer(focus, { type: 'start' }, Date.now())
    saveFocusState('owner', focus)
    await resolveRead(latestRead(), [task()])
    await vi.advanceTimersByTimeAsync(1000)
    expect(runtime.notify).toHaveBeenCalledTimes(1)

    vi.setSystemTime(new Date('2026-09-12T10:26:00'))
    windowEvents.dispatchEvent(new Event('todoer:focus-changed'))
    await resolveRead(latestRead(), [task({ updated_at: '2026-09-12T10:25:00.000Z' })])
    await vi.advanceTimersByTimeAsync(1000)
    expect(runtime.notify).toHaveBeenCalledTimes(1)

    dispose()
    vi.setSystemTime(new Date('2026-09-14T10:00:00'))
    mountRuntime()
    await resolveRead(latestRead(), [task()])
    await vi.advanceTimersByTimeAsync(1000)
    expect(runtime.notify).toHaveBeenCalledTimes(1)
  })

  it('holds an overdue foreground slot when the app resumes inside quiet hours', async () => {
    vi.setSystemTime(new Date('2026-09-12T21:59:58'))
    setReminderSettings('owner', { quietEnabled: true, quietStart: '22:00', quietEnd: '07:00' })
    mountRuntime()
    await resolveRead(latestRead(), [task({ due_time: '21:59:59' })])
    documentEvents.visibilityState = 'hidden'
    await vi.advanceTimersByTimeAsync(2000)
    documentEvents.visibilityState = 'visible'
    // The clock can resume before the browser's visibility handler replans.
    await vi.advanceTimersByTimeAsync(1000)
    expect(runtime.notify).not.toHaveBeenCalled()
    documentEvents.dispatchEvent(new Event('visibilitychange'))
    await resolveRead(latestRead(), [task({ due_time: '21:59:59' })])
    expect(runtime.state.nativePlan[0].at).toBe(new Date('2026-09-13T07:00:00').getTime())
  })
})
