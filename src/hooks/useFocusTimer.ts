'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  advanceFocusTimer,
  countFocusSessions,
  createFocusState,
  FOCUS_CHANGED_EVENT,
  focusStorageKey,
  isFreshFocusTick,
  loadFocusState,
  remainingFocusMs,
  saveFocusState,
  transitionFocusTimer,
  type FocusAction,
  type FocusState,
} from '@/lib/focus-timer'

interface TimerSnapshot {
  userId: string | null
  state: FocusState
  now: number
  ready: boolean
  persistenceError: boolean
}

/** The interval only refreshes the display; elapsed time comes from the saved deadline. */
export function useFocusTimer(userId: string | null, onLiveCompletion: () => void) {
  const [empty] = useState(() => createFocusState())
  const [snapshot, setSnapshot] = useState<TimerSnapshot>({
    userId: null, state: empty, now: 0, ready: false, persistenceError: false,
  })
  const handler = useRef<{ userId: string; apply: (action: FocusAction) => void } | null>(null)

  useEffect(() => {
    if (!userId) return

    let state = loadFocusState(userId)
    let persistenceError = false
    let writing = false
    let lastTick: number | null = null
    let wasVisible = document.visibilityState === 'visible'

    function publish(next: FocusState, now: number, persist: boolean) {
      state = next
      if (persist) {
        writing = true
        persistenceError = !saveFocusState(userId!, next)
        writing = false
      }
      setSnapshot({ userId, state: next, now, ready: true, persistenceError })
    }

    function tick(allowAutoStart = false) {
      const now = Date.now()
      const visible = document.visibilityState === 'visible'
      const fresh = allowAutoStart && isFreshFocusTick(lastTick, now, wasVisible, visible)
      // Another tab may have changed the timer while this page was suspended.
      if (!persistenceError) state = loadFocusState(userId!)
      const next = advanceFocusTimer(state, now, fresh)
      const completed = next !== state
      const newCompletion = completed && !Object.hasOwn(state.completions, state.session.id)
      publish(next, now, completed)
      lastTick = now
      wasVisible = visible
      // Sounds and persistence are deliberately outside React state updater functions.
      if (newCompletion && fresh) onLiveCompletion()
    }

    function recover() {
      lastTick = null
      tick()
    }

    function syncFromStorage(event: Event) {
      if (writing) return
      if (event instanceof StorageEvent && event.key !== null && event.key !== focusStorageKey(userId!)) return
      const stored = loadFocusState(userId!)
      const now = Date.now()
      const next = advanceFocusTimer(stored, now)
      publish(next, now, next !== stored)
      lastTick = null
    }

    const now = Date.now()
    publish(advanceFocusTimer(state, now), now, true)
    handler.current = {
      userId,
      apply(action) {
        const now = Date.now()
        if (!persistenceError) state = loadFocusState(userId!)
        publish(transitionFocusTimer(state, action, now), now, true)
      },
    }
    const interval = window.setInterval(() => tick(true), 250)
    window.addEventListener(FOCUS_CHANGED_EVENT, syncFromStorage)
    window.addEventListener('storage', syncFromStorage)
    window.addEventListener('pageshow', recover)
    document.addEventListener('visibilitychange', recover)
    return () => {
      handler.current = null
      window.clearInterval(interval)
      window.removeEventListener(FOCUS_CHANGED_EVENT, syncFromStorage)
      window.removeEventListener('storage', syncFromStorage)
      window.removeEventListener('pageshow', recover)
      document.removeEventListener('visibilitychange', recover)
    }
  }, [userId, onLiveCompletion])

  const dispatch = useCallback((action: FocusAction) => {
    if (handler.current?.userId === userId) handler.current.apply(action)
  }, [userId])
  // Account changes must never briefly render the previous account's timer or task ID.
  const active = userId !== null && snapshot.userId === userId
  const state = active ? snapshot.state : empty
  return {
    state,
    ready: active && snapshot.ready,
    persistenceError: active && snapshot.persistenceError,
    timeLeft: Math.ceil(remainingFocusMs(state.session, snapshot.now) / 1000),
    completedSessions: active ? countFocusSessions(state, snapshot.now) : 0,
    dispatch,
  }
}
