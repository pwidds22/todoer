'use client'

import { useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useQueryClient } from '@tanstack/react-query'
import type { Task } from '@/types/database'

// Play a notification sound
function playNagSound() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioCtx.createOscillator()
    const gainNode = audioCtx.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(audioCtx.destination)
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime) // A5
    oscillator.type = 'sine'
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5)
    oscillator.start(audioCtx.currentTime)
    oscillator.stop(audioCtx.currentTime + 0.5)
    // Second beep
    const osc2 = audioCtx.createOscillator()
    const gain2 = audioCtx.createGain()
    osc2.connect(gain2)
    gain2.connect(audioCtx.destination)
    osc2.frequency.setValueAtTime(1100, audioCtx.currentTime + 0.15)
    osc2.type = 'sine'
    gain2.gain.setValueAtTime(0.3, audioCtx.currentTime + 0.15)
    gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.65)
    osc2.start(audioCtx.currentTime + 0.15)
    osc2.stop(audioCtx.currentTime + 0.65)
  } catch {
    // AudioContext not available
  }
}

function showBrowserNotification(task: Task) {
  if ('Notification' in window && Notification.permission === 'granted') {
    const notification = new Notification(`⏰ Nag: ${task.title}`, {
      body: task.due_time
        ? `Due at ${task.due_time} — This task needs your attention!`
        : 'This task needs your attention!',
      icon: '/icons/icon-192x192.svg',
      tag: `nag-${task.id}`,
      requireInteraction: true,
    })

    notification.onclick = () => {
      window.focus()
      notification.close()
    }
  }
}

export function NagReminder() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const supabase = createClient()
  const nagTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const activeTasksRef = useRef<Map<string, Task>>(new Map())

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const nagTask = useCallback((task: Task) => {
    playNagSound()
    showBrowserNotification(task)
    // Update last_nag_at
    supabase
      .from('tasks')
      .update({ last_nag_at: new Date().toISOString() })
      .eq('id', task.id)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] })
      })
  }, [supabase, queryClient])

  const setupNagTimer = useCallback((task: Task) => {
    // Clear existing timer for this task
    const existing = nagTimersRef.current.get(task.id)
    if (existing) clearInterval(existing)

    const intervalMs = (task.nag_interval || 60) * 1000

    // Nag immediately if overdue or due now
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    let shouldNagNow = false

    if (task.due_date && task.due_date <= todayStr) {
      if (task.due_time) {
        const dueDateTime = new Date(`${task.due_date}T${task.due_time}`)
        if (dueDateTime <= now) shouldNagNow = true
      } else {
        shouldNagNow = true
      }
    } else if (!task.due_date) {
      // No due date but nag is enabled - nag anyway
      shouldNagNow = true
    }

    // Check if enough time has passed since last nag
    if (shouldNagNow && task.last_nag_at) {
      const lastNag = new Date(task.last_nag_at)
      const elapsed = now.getTime() - lastNag.getTime()
      if (elapsed < intervalMs) {
        shouldNagNow = false
      }
    }

    if (shouldNagNow) {
      // Small delay to avoid nagging on page load
      setTimeout(() => nagTask(task), 2000)
    }

    // Set up recurring nag
    const timer = setInterval(() => {
      // Re-check if task is still nag-worthy
      const currentTask = activeTasksRef.current.get(task.id)
      if (!currentTask || currentTask.is_completed || !currentTask.nag_enabled) {
        clearInterval(timer)
        nagTimersRef.current.delete(task.id)
        return
      }

      const checkNow = new Date()
      const checkTodayStr = checkNow.toISOString().split('T')[0]
      let shouldNag = false

      if (currentTask.due_date && currentTask.due_date <= checkTodayStr) {
        if (currentTask.due_time) {
          const dueDateTime = new Date(`${currentTask.due_date}T${currentTask.due_time}`)
          if (dueDateTime <= checkNow) shouldNag = true
        } else {
          shouldNag = true
        }
      } else if (!currentTask.due_date) {
        shouldNag = true
      }

      if (shouldNag) {
        nagTask(currentTask)
      }
    }, intervalMs)

    nagTimersRef.current.set(task.id, timer)
    activeTasksRef.current.set(task.id, task)
  }, [nagTask])

  // Poll for nag-enabled tasks
  useEffect(() => {
    if (!user) return

    let isMounted = true

    async function checkNagTasks() {
      if (!isMounted) return

      const { data } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user!.id)
        .eq('nag_enabled', true)
        .eq('is_completed', false)
        .eq('is_deleted', false)

      if (!data || !isMounted) return
      const tasks = data as Task[]

      // Update active tasks ref
      const currentIds = new Set(tasks.map(t => t.id))

      // Remove timers for tasks no longer nag-enabled
      for (const [id, timer] of nagTimersRef.current) {
        if (!currentIds.has(id)) {
          clearInterval(timer)
          nagTimersRef.current.delete(id)
          activeTasksRef.current.delete(id)
        }
      }

      // Set up timers for new nag tasks
      for (const task of tasks) {
        activeTasksRef.current.set(task.id, task)
        if (!nagTimersRef.current.has(task.id)) {
          setupNagTimer(task)
        }
      }
    }

    // Initial check
    checkNagTasks()

    // Re-check every 30 seconds for new nag tasks
    const pollInterval = setInterval(checkNagTasks, 30000)

    return () => {
      isMounted = false
      clearInterval(pollInterval)
      for (const timer of nagTimersRef.current.values()) {
        clearInterval(timer)
      }
      nagTimersRef.current.clear()
      activeTasksRef.current.clear()
    }
  }, [user, supabase, setupNagTimer])

  // This is a headless component - no UI
  return null
}
