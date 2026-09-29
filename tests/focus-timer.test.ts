import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  advanceFocusTimer,
  countFocusSessions,
  createFocusState,
  focusStorageKey,
  isFreshFocusTick,
  loadFocusState,
  localFocusDay,
  readFocusSuppression,
  remainingFocusMs,
  saveFocusState,
  transitionFocusTimer,
  validateFocusSettings,
} from '../src/lib/focus-timer'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
  }
}

const start = new Date(2026, 8, 12, 9, 0).getTime()

afterEach(() => { vi.unstubAllGlobals() })

describe('focus timer recovery', () => {
  it('counts down from the deadline after a suspended tab, without requiring ticks', () => {
    const state = transitionFocusTimer(createFocusState('first'), { type: 'start' }, start)
    expect(state.session.endsAt).toBe(start + 25 * 60_000)
    expect(remainingFocusMs(state.session, start + 10 * 60_000 + 250)).toBe(899_750)
    expect(remainingFocusMs(state.session, start + 30 * 60_000)).toBe(0)
  })

  it('freezes exact remaining time while paused and gives resume a new deadline', () => {
    let state = transitionFocusTimer(createFocusState('first'), { type: 'start' }, start)
    state = transitionFocusTimer(state, { type: 'pause' }, start + 90_250)
    expect(state.session.endsAt).toBeNull()
    expect(remainingFocusMs(state.session, start + 800_000)).toBe(1_409_750)
    state = transitionFocusTimer(state, { type: 'start' }, start + 800_000)
    expect(state.session.endsAt).toBe(start + 2_209_750)
    expect(state.session.id).toBe('first')
  })

  it('restores paused time and task association after reopening', () => {
    const storage = memoryStorage()
    let state = transitionFocusTimer(createFocusState('first'), { type: 'task', taskId: 'task-a' }, start)
    state = transitionFocusTimer(state, { type: 'start' }, start)
    state = transitionFocusTimer(state, { type: 'pause' }, start + 120_000)
    expect(saveFocusState('alice', state, storage)).toBe(true)
    const loaded = loadFocusState('alice', storage)
    expect(loaded.session.taskId).toBe('task-a')
    expect(remainingFocusMs(loaded.session, start + 86_400_000)).toBe(1_380_000)
    expect(loaded.session.status).toBe('paused')
  })

  it('records an elapsed session once, prepares a paused break, and never invents absent sessions', () => {
    const storage = memoryStorage()
    let state = transitionFocusTimer(createFocusState('first'), {
      type: 'settings', settings: { autoStartBreaks: true, autoStartFocus: true },
    }, start)
    state = transitionFocusTimer(state, { type: 'start' }, start)
    saveFocusState('alice', state, storage)
    const recovered = advanceFocusTimer(loadFocusState('alice', storage), start + 4 * 60 * 60_000)
    expect(recovered.session.type).toBe('shortBreak')
    expect(recovered.session.status).toBe('paused')
    expect(recovered.lastCompletion?.sessionId).toBe('first')
    expect(countFocusSessions(recovered, start)).toBe(1)
    saveFocusState('alice', recovered, storage)
    const secondReload = advanceFocusTimer(loadFocusState('alice', storage), start + 8 * 60 * 60_000)
    expect(countFocusSessions(secondReload, start)).toBe(1)
    // A stale tab replaying the completed session must not double the count.
    const stale = advanceFocusTimer({ ...secondReload, session: state.session }, start + 8 * 60 * 60_000)
    expect(countFocusSessions(stale, start)).toBe(1)
  })

  it('can auto-start one successor only at a fresh foreground completion', () => {
    let state = transitionFocusTimer(createFocusState('first'), {
      type: 'settings', settings: { autoStartBreaks: true },
    }, start)
    state = transitionFocusTimer(state, { type: 'start' }, start)
    const next = advanceFocusTimer(state, start + 25 * 60_000, true)
    expect(next.session.type).toBe('shortBreak')
    expect(next.session.status).toBe('running')
    expect(next.session.endsAt).toBe(start + 30 * 60_000)
    expect(countFocusSessions(next, start)).toBe(1)
  })

  it('does not consider a reopened, hidden or suspended page a fresh auto-start tick', () => {
    expect(isFreshFocusTick(null, start, true, true)).toBe(false)
    expect(isFreshFocusTick(start, start + 60_000, true, true)).toBe(false)
    expect(isFreshFocusTick(start, start + 250, false, true)).toBe(false)
    expect(isFreshFocusTick(start, start + 250, true, false)).toBe(false)
    expect(isFreshFocusTick(start, start + 250, true, true)).toBe(true)
  })

  it('does not auto-start again when a stale tab replays an already completed deadline', () => {
    let original = transitionFocusTimer(createFocusState('first'), {
      type: 'settings', settings: { autoStartBreaks: true },
    }, start)
    original = transitionFocusTimer(original, { type: 'start' }, start)
    const completed = advanceFocusTimer(original, start + 1_500_000, true)
    const replay = advanceFocusTimer({ ...completed, session: original.session }, start + 1_560_000, true)
    expect(replay.session.status).toBe('paused')
    expect(countFocusSessions(replay, start)).toBe(1)
  })

  it('records a break completion for replay protection without adding to the focus count', () => {
    let state = transitionFocusTimer(createFocusState('first'), { type: 'switch', sessionType: 'shortBreak' }, start)
    state = transitionFocusTimer(state, { type: 'settings', settings: { autoStartFocus: true } }, start)
    state = transitionFocusTimer(state, { type: 'start' }, start)
    const completed = advanceFocusTimer(state, start + 300_000, true)
    expect(completed.session.type).toBe('focus')
    expect(completed.session.status).toBe('running')
    expect(countFocusSessions(completed, start)).toBe(0)
    const replay = advanceFocusTimer({ ...completed, session: state.session }, start + 360_000, true)
    expect(replay.session.status).toBe('paused')
  })

  it('counts the local date of the deadline, even when reopened the next day', () => {
    const late = new Date(2026, 8, 12, 23, 30).getTime()
    const state = transitionFocusTimer(createFocusState('first'), { type: 'start' }, late)
    const nextDay = new Date(2026, 8, 13, 8).getTime()
    const recovered = advanceFocusTimer(state, nextDay)
    expect(localFocusDay(late)).toBe('2026-09-12')
    expect(countFocusSessions(recovered, late)).toBe(1)
    expect(countFocusSessions(recovered, nextDay)).toBe(0)
  })

  it('does not reset a paused session when settings change', () => {
    let state = transitionFocusTimer(createFocusState('first'), { type: 'start' }, start)
    state = transitionFocusTimer(state, { type: 'pause' }, start + 300_000)
    state = transitionFocusTimer(state, { type: 'settings', settings: { focusMinutes: 40 } }, start)
    expect(state.settings.focusMinutes).toBe(40)
    expect(state.session.durationMs).toBe(1_500_000)
    expect(state.session.remainingMs).toBe(1_200_000)
    const reset = transitionFocusTimer(state, { type: 'reset' }, start)
    expect(reset.session.remainingMs).toBe(2_400_000)
    expect(reset.session.status).toBe('paused')
    expect(reset.session.id).not.toBe('first')
  })
})

describe('focus persistence and reminder suppression', () => {
  it('isolates settings, timers and counts by account without adopting old global keys', () => {
    const storage = memoryStorage()
    storage.setItem('todoer-focus-settings', JSON.stringify({ focusMinutes: 60 }))
    let alice = transitionFocusTimer(createFocusState('alice-session'), { type: 'task', taskId: 'task-a' }, start)
    alice = transitionFocusTimer(alice, { type: 'start' }, start)
    saveFocusState('alice', alice, storage)
    expect(loadFocusState('alice', storage).session.id).toBe('alice-session')
    const bob = loadFocusState('bob', storage)
    expect(bob.session.taskId).toBeNull()
    expect(bob.session.status).toBe('paused')
    expect(bob.settings.focusMinutes).toBe(25)
    expect(countFocusSessions(bob, start)).toBe(0)
  })

  it('preserves completed session IDs when another tab saves an older snapshot', () => {
    const storage = memoryStorage()
    const original = transitionFocusTimer(createFocusState('first'), { type: 'start' }, start)
    saveFocusState('alice', advanceFocusTimer(original, start + 1_500_000), storage)
    saveFocusState('alice', original, storage)
    expect(countFocusSessions(loadFocusState('alice', storage), start)).toBe(1)
  })

  it('notifies the current window when a linked task starts or pauses', () => {
    const events = new EventTarget()
    vi.stubGlobal('window', {
      localStorage: memoryStorage(), dispatchEvent: events.dispatchEvent.bind(events),
    })
    const observed: Array<{ taskId: string; until: number } | null> = []
    events.addEventListener('todoer:focus-changed', () => { observed.push(readFocusSuppression('alice', start)) })
    let state = transitionFocusTimer(createFocusState('first'), { type: 'task', taskId: 'task-a' }, start)
    state = transitionFocusTimer(state, { type: 'start' }, start)
    saveFocusState('alice', state)
    saveFocusState('alice', transitionFocusTimer(state, { type: 'pause' }, start + 10_000))
    expect(observed).toEqual([{ taskId: 'task-a', until: start + 1_500_000 }, null])
  })

  it('suppresses only the linked running focus task until its stored deadline', () => {
    const storage = memoryStorage()
    vi.stubGlobal('window', { localStorage: storage, dispatchEvent: () => true })
    let state = transitionFocusTimer(createFocusState('first'), { type: 'start' }, start)
    saveFocusState('alice', state)
    expect(readFocusSuppression('alice', start)).toBeNull()
    state = transitionFocusTimer(state, { type: 'task', taskId: 'task-a' }, start)
    saveFocusState('alice', state)
    expect(readFocusSuppression('alice', start + 10_000)).toEqual({ taskId: 'task-a', until: start + 1_500_000 })
    expect(readFocusSuppression('bob', start)).toBeNull()
    expect(readFocusSuppression('alice', start + 1_500_000)).toBeNull()
    state = transitionFocusTimer(state, { type: 'pause' }, start + 10_000)
    saveFocusState('alice', state)
    expect(readFocusSuppression('alice', start + 10_000)).toBeNull()
    state = transitionFocusTimer(state, { type: 'switch', sessionType: 'shortBreak' }, start)
    state = transitionFocusTimer(state, { type: 'start' }, start)
    saveFocusState('alice', state)
    expect(readFocusSuppression('alice', start)).toBeNull()
  })

  it('validates malformed settings instead of accepting impossible durations or truthy strings', () => {
    expect(validateFocusSettings({
      focusMinutes: -20, shortBreakMinutes: '10', longBreakMinutes: Infinity,
      longBreakInterval: 0, autoStartBreaks: 'false', autoStartFocus: true,
    })).toEqual({
      focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15,
      longBreakInterval: 4, autoStartBreaks: false, autoStartFocus: true,
    })
    expect(validateFocusSettings(null).focusMinutes).toBe(25)
  })

  it.each(['{', 'null', '[]', '{"version":999}', '{"version":1,"session":{"status":"running","endsAt":"tomorrow"}}'])(
    'recovers safely from malformed timer storage: %s', (raw) => {
      const storage = memoryStorage()
      storage.setItem(focusStorageKey('alice'), raw)
      const state = loadFocusState('alice', storage)
      expect(state.session.status).toBe('paused')
      expect(state.session.endsAt).toBeNull()
      expect(state.session.remainingMs).toBe(1_500_000)
      expect(countFocusSessions(state, start)).toBe(0)
    },
  )

  it('returns a visible persistence failure signal when storage is blocked', () => {
    const blocked = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    }
    expect(loadFocusState('alice', blocked).session.status).toBe('paused')
    expect(saveFocusState('alice', createFocusState('first'), blocked)).toBe(false)
  })
})
