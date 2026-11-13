export type SessionType = 'focus' | 'shortBreak' | 'longBreak'

export interface FocusSettings {
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  longBreakInterval: number
  autoStartBreaks: boolean
  autoStartFocus: boolean
}

export interface FocusSession {
  id: string
  type: SessionType
  status: 'running' | 'paused'
  durationMs: number
  remainingMs: number
  endsAt: number | null
  taskId: string | null
}

interface FocusCompletion {
  sessionId: string
  type: SessionType
  completedAt: number
}

export interface FocusState {
  version: 1
  settings: FocusSettings
  session: FocusSession
  completions: Record<string, { completedAt: number; day: string; type: SessionType }>
  lastCompletion: FocusCompletion | null
}

type FocusStorage = Pick<Storage, 'getItem' | 'setItem'>

export const FOCUS_CHANGED_EVENT = 'todoer:focus-changed'
export const DEFAULT_FOCUS_SETTINGS: FocusSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakInterval: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null
}

function numberInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

export function validateFocusSettings(value: unknown): FocusSettings {
  const input = record(value) ?? {}
  function minutes(key: keyof FocusSettings, min: number, max: number) {
    const value = input[key]
    return numberInRange(value, min, max) && Number.isInteger(value)
      ? value : DEFAULT_FOCUS_SETTINGS[key] as number
  }
  return {
    focusMinutes: minutes('focusMinutes', 1, 60),
    shortBreakMinutes: minutes('shortBreakMinutes', 1, 30),
    longBreakMinutes: minutes('longBreakMinutes', 1, 60),
    longBreakInterval: minutes('longBreakInterval', 2, 10),
    autoStartBreaks: typeof input.autoStartBreaks === 'boolean' ? input.autoStartBreaks : false,
    autoStartFocus: typeof input.autoStartFocus === 'boolean' ? input.autoStartFocus : false,
  }
}

function newSessionId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function durationMs(type: SessionType, settings: FocusSettings): number {
  const minutes = type === 'focus' ? settings.focusMinutes
    : type === 'shortBreak' ? settings.shortBreakMinutes : settings.longBreakMinutes
  return minutes * 60_000
}

function createSession(type: SessionType, settings: FocusSettings, taskId: string | null, id = newSessionId()): FocusSession {
  const duration = durationMs(type, settings)
  return { id, type, status: 'paused', durationMs: duration, remainingMs: duration, endsAt: null, taskId }
}

export function createFocusState(sessionId?: string): FocusState {
  const settings = { ...DEFAULT_FOCUS_SETTINGS }
  return { version: 1, settings, session: createSession('focus', settings, null, sessionId), completions: {}, lastCompletion: null }
}

export function localFocusDay(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function countFocusSessions(state: FocusState, now: number): number {
  const day = localFocusDay(now)
  return Object.values(state.completions).filter(completion => completion.type === 'focus' && completion.day === day).length
}

export function remainingFocusMs(session: FocusSession, now: number): number {
  return session.status === 'running' && session.endsAt !== null
    ? Math.max(0, Math.min(session.durationMs, session.endsAt - now))
    : session.remainingMs
}

export function isFreshFocusTick(lastTick: number | null, now: number, wasVisible: boolean, visible: boolean): boolean {
  return lastTick !== null && now >= lastTick && now - lastTick <= 2_000 && wasVisible && visible
}

/** Reconcile one real deadline. Never simulate a chain of sessions during absence. */
export function advanceFocusTimer(state: FocusState, now: number, freshForegroundTick = false): FocusState {
  const current = state.session
  if (current.status !== 'running' || current.endsAt === null || current.endsAt > now) return state

  const alreadyCompleted = Object.hasOwn(state.completions, current.id)
  const completions = alreadyCompleted ? state.completions : {
    ...state.completions,
    [current.id]: { completedAt: current.endsAt, day: localFocusDay(current.endsAt), type: current.type },
  }
  // A session ID is the completion key, so replaying a deadline never increments twice.
  const count = countFocusSessions({ ...state, completions }, current.endsAt)
  const nextType: SessionType = current.type === 'focus'
    ? count % state.settings.longBreakInterval === 0 ? 'longBreak' : 'shortBreak'
    : 'focus'
  let session = createSession(nextType, state.settings, current.taskId)
  const autoStart = current.type === 'focus' ? state.settings.autoStartBreaks : state.settings.autoStartFocus
  if (freshForegroundTick && autoStart && !alreadyCompleted) {
    session = { ...session, status: 'running', endsAt: now + session.remainingMs }
  }
  return {
    ...state, session, completions,
    lastCompletion: { sessionId: current.id, type: current.type, completedAt: current.endsAt },
  }
}

export type FocusAction =
  | { type: 'start' | 'pause' | 'reset' }
  | { type: 'switch'; sessionType: SessionType }
  | { type: 'task'; taskId: string | null }
  | { type: 'settings'; settings: Partial<FocusSettings> }

export function transitionFocusTimer(previous: FocusState, action: FocusAction, now: number): FocusState {
  const state = advanceFocusTimer(previous, now)
  const session = state.session
  switch (action.type) {
    case 'start':
      return session.status === 'running' ? state : {
        ...state, lastCompletion: null,
        session: { ...session, status: 'running', endsAt: now + session.remainingMs },
      }
    case 'pause':
      return session.status === 'paused' ? state : {
        ...state,
        session: { ...session, status: 'paused', endsAt: null, remainingMs: remainingFocusMs(session, now) },
      }
    case 'reset':
    case 'switch':
      return {
        ...state, lastCompletion: null,
        session: createSession(action.type === 'switch' ? action.sessionType : session.type, state.settings, session.taskId),
      }
    case 'task':
      return { ...state, session: { ...session, taskId: action.taskId } }
    case 'settings': {
      const settings = validateFocusSettings({ ...state.settings, ...action.settings })
      const untouched = session.status === 'paused' && session.remainingMs === session.durationMs
      return {
        ...state, settings,
        session: untouched ? createSession(session.type, settings, session.taskId, session.id) : session,
      }
    }
  }
}

export function focusStorageKey(userId: string): string {
  return `todoer-focus:v1:${encodeURIComponent(userId)}`
}

function browserStorage(): FocusStorage | null {
  try { return typeof window !== 'undefined' ? window.localStorage : null } catch { return null }
}

function isSessionType(value: unknown): value is SessionType {
  return value === 'focus' || value === 'shortBreak' || value === 'longBreak'
}

function parseFocusState(raw: string | null): FocusState {
  const fallback = createFocusState()
  if (!raw) return fallback
  const input = record(JSON.parse(raw))
  if (input?.version !== 1) return fallback
  const settings = validateFocusSettings(input.settings)
  const session = record(input.session)
  const validSession = session
    && typeof session.id === 'string' && session.id.length > 0 && session.id.length < 200
    && isSessionType(session.type)
    && (session.status === 'paused' || session.status === 'running')
    && numberInRange(session.durationMs, 60_000, 3_600_000)
    && numberInRange(session.remainingMs, 0, session.durationMs)
    && (session.status === 'running' ? numberInRange(session.endsAt, 1, 8_640_000_000_000_000) : session.endsAt === null)
    && (session.taskId === null || (typeof session.taskId === 'string' && session.taskId.length > 0))
  const completions: FocusState['completions'] = {}
  for (const [id, entry] of Object.entries(record(input.completions) ?? {})) {
    const item = record(entry)
    if (item && numberInRange(item.completedAt, 1, 8_640_000_000_000_000)
      && typeof item.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.day)) {
      const type = isSessionType(item.type) ? item.type : 'focus'
      Object.defineProperty(completions, id, { value: { completedAt: item.completedAt, day: item.day, type }, enumerable: true, writable: true, configurable: true })
    }
  }
  const completion = record(input.lastCompletion)
  const validCompletion = completion && typeof completion.sessionId === 'string'
    && isSessionType(completion.type) && numberInRange(completion.completedAt, 1, 8_640_000_000_000_000)
  return {
    version: 1, settings, completions,
    session: validSession ? session as unknown as FocusSession : createSession('focus', settings, null),
    lastCompletion: validCompletion ? completion as unknown as FocusCompletion : null,
  }
}

export function loadFocusState(userId: string, storage: FocusStorage | null = browserStorage()): FocusState {
  try { return parseFocusState(storage?.getItem(focusStorageKey(userId)) ?? null) }
  catch { return createFocusState() }
}

export function saveFocusState(userId: string, state: FocusState, storage: FocusStorage | null = browserStorage()): boolean {
  if (!storage || !userId) return false
  try {
    const stored = loadFocusState(userId, storage)
    // Old tab snapshots can change the current timer, but must not erase recorded work.
    const merged = { ...state, completions: { ...stored.completions, ...state.completions } }
    storage.setItem(focusStorageKey(userId), JSON.stringify(merged))
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(FOCUS_CHANGED_EVENT))
    return true
  } catch { return false }
}

/** Active linked focus only; the deadline bounds suppression even while the app is closed. */
export function readFocusSuppression(userId: string, now: number): { taskId: string; until: number } | null {
  if (!userId) return null
  const { session } = loadFocusState(userId)
  return session.type === 'focus' && session.status === 'running' && session.taskId
    && session.endsAt !== null && session.endsAt > now
    ? { taskId: session.taskId, until: session.endsAt } : null
}
