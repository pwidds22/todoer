'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTasks } from '@/hooks/useTasks'
import { Timer, Play, Pause, RotateCcw, Coffee, Target, ChevronDown, Check, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// --- Types ---

type SessionType = 'focus' | 'shortBreak' | 'longBreak'

interface SessionConfig {
  label: string
  minutes: number
  color: string
  icon: React.ReactNode
}

// --- Constants ---

const SESSION_CONFIGS: Record<SessionType, SessionConfig> = {
  focus: { label: 'Focus', minutes: 25, color: '#7c3aed', icon: <Target className="h-4 w-4" /> },
  shortBreak: { label: 'Short Break', minutes: 5, color: '#22c55e', icon: <Coffee className="h-4 w-4" /> },
  longBreak: { label: 'Long Break', minutes: 15, color: '#3b82f6', icon: <Coffee className="h-4 w-4" /> },
}

const STORAGE_KEY = 'todoer-focus-sessions'
const CIRCLE_RADIUS = 120
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS

// --- Audio ---

function playCompletionSound() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()

    // Rising three-tone chime
    const notes = [523.25, 659.25, 783.99] // C5, E5, G5
    notes.forEach((freq, i) => {
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime + i * 0.15)
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.25, audioCtx.currentTime + i * 0.15)
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + i * 0.15 + 0.4)
      osc.start(audioCtx.currentTime + i * 0.15)
      osc.stop(audioCtx.currentTime + i * 0.15 + 0.4)
    })
  } catch {
    // AudioContext not available
  }
}

// --- LocalStorage helpers ---

function getTodaySessions(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return 0
    const data = JSON.parse(raw)
    const today = new Date().toISOString().split('T')[0]
    return data[today] || 0
  } catch {
    return 0
  }
}

function incrementTodaySessions(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const data = raw ? JSON.parse(raw) : {}
    const today = new Date().toISOString().split('T')[0]

    // Clean up entries older than 7 days
    const cutoff = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
    for (const key of Object.keys(data)) {
      if (key < cutoff) delete data[key]
    }

    data[today] = (data[today] || 0) + 1
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return data[today]
  } catch {
    return 0
  }
}

// --- Component ---

export default function FocusPage() {
  const { data: tasks, isLoading } = useTasks({ isCompleted: false })

  // Timer state
  const [sessionType, setSessionType] = useState<SessionType>('focus')
  const [timeLeft, setTimeLeft] = useState(SESSION_CONFIGS.focus.minutes * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [completedSessions, setCompletedSessions] = useState(0)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [taskDropdownOpen, setTaskDropdownOpen] = useState(false)
  const [sessionJustCompleted, setSessionJustCompleted] = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const totalSeconds = SESSION_CONFIGS[sessionType].minutes * 60
  const progress = (totalSeconds - timeLeft) / totalSeconds
  const dashOffset = CIRCLE_CIRCUMFERENCE * (1 - progress)

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const displayTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  const activeColor = SESSION_CONFIGS[sessionType].color

  const selectedTask = tasks?.find(t => t.id === selectedTaskId)

  // Load sessions from localStorage on mount
  useEffect(() => {
    setCompletedSessions(getTodaySessions())
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setTaskDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Timer countdown
  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setIsRunning(false)
          handleSessionComplete()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning])

  // Update document title with timer
  useEffect(() => {
    if (isRunning) {
      document.title = `${displayTime} - ${SESSION_CONFIGS[sessionType].label} | Todoer`
    } else {
      document.title = 'Focus | Todoer'
    }
    return () => { document.title = 'Todoer' }
  }, [displayTime, isRunning, sessionType])

  const handleSessionComplete = useCallback(() => {
    playCompletionSound()
    setSessionJustCompleted(true)
    setTimeout(() => setSessionJustCompleted(false), 3000)

    if (sessionType === 'focus') {
      const newCount = incrementTodaySessions()
      setCompletedSessions(newCount)

      // After 4 focus sessions, suggest long break; otherwise short break
      if (newCount % 4 === 0) {
        switchSession('longBreak')
      } else {
        switchSession('shortBreak')
      }
    } else {
      // After a break, go back to focus
      switchSession('focus')
    }
  }, [sessionType])

  function switchSession(type: SessionType) {
    setSessionType(type)
    setTimeLeft(SESSION_CONFIGS[type].minutes * 60)
    setIsRunning(false)
  }

  function toggleTimer() {
    setIsRunning(prev => !prev)
  }

  function resetTimer() {
    setIsRunning(false)
    setTimeLeft(SESSION_CONFIGS[sessionType].minutes * 60)
  }

  function selectTask(taskId: string | null) {
    setSelectedTaskId(taskId)
    setTaskDropdownOpen(false)
  }

  // Priority indicator colors matching Todoist
  function priorityColor(priority: number | null) {
    switch (priority) {
      case 4: return 'text-red-500'
      case 3: return 'text-orange-500'
      case 2: return 'text-blue-500'
      default: return 'text-zinc-500'
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <Timer className="h-6 w-6 text-purple-500" />
          <h1 className="text-2xl font-bold">Focus</h1>
        </div>
        <p className="text-sm text-muted-foreground ml-9">
          Stay focused with the Pomodoro technique
        </p>
      </div>

      {/* Session type toggle */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex bg-zinc-800/60 rounded-xl p-1 gap-1">
          {(Object.keys(SESSION_CONFIGS) as SessionType[]).map(type => (
            <button
              key={type}
              onClick={() => {
                if (!isRunning) switchSession(type)
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                sessionType === type
                  ? 'bg-zinc-700 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
              } ${isRunning && sessionType !== type ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {SESSION_CONFIGS[type].icon}
              {SESSION_CONFIGS[type].label}
            </button>
          ))}
        </div>
      </div>

      {/* Timer display */}
      <div className="flex flex-col items-center mb-8">
        <motion.div
          className="relative"
          animate={sessionJustCompleted ? { scale: [1, 1.05, 1] } : {}}
          transition={{ duration: 0.5 }}
        >
          <svg width="280" height="280" className="transform -rotate-90">
            {/* Background circle */}
            <circle
              cx="140"
              cy="140"
              r={CIRCLE_RADIUS}
              fill="none"
              stroke="currentColor"
              className="text-zinc-800"
              strokeWidth="8"
            />
            {/* Progress circle */}
            <motion.circle
              cx="140"
              cy="140"
              r={CIRCLE_RADIUS}
              fill="none"
              stroke={activeColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={CIRCLE_CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              initial={false}
              animate={{ strokeDashoffset: dashOffset }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
            />
          </svg>

          {/* Time display in center */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.span
                key={displayTime}
                initial={{ opacity: 0.6, y: 2 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0.6, y: -2 }}
                transition={{ duration: 0.15 }}
                className="text-5xl font-mono font-bold tracking-wider text-zinc-100"
              >
                {displayTime}
              </motion.span>
            </AnimatePresence>
            <span className="text-sm text-zinc-400 mt-1">
              {SESSION_CONFIGS[sessionType].label}
            </span>
          </div>
        </motion.div>

        {/* Completion flash */}
        <AnimatePresence>
          {sessionJustCompleted && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-2 px-4 py-1.5 rounded-full text-sm font-medium"
              style={{ backgroundColor: `${activeColor}20`, color: activeColor }}
            >
              Session complete!
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 mb-8">
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={resetTimer}
          className="p-3 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
          title="Reset"
        >
          <RotateCcw className="h-5 w-5" />
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={toggleTimer}
          className="p-5 rounded-full text-white shadow-lg transition-all duration-200"
          style={{ backgroundColor: activeColor }}
          title={isRunning ? 'Pause' : 'Start'}
        >
          {isRunning ? (
            <Pause className="h-7 w-7" fill="currentColor" />
          ) : (
            <Play className="h-7 w-7 ml-0.5" fill="currentColor" />
          )}
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={resetTimer}
          className="p-3 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors opacity-0 pointer-events-none"
          aria-hidden
        >
          <RotateCcw className="h-5 w-5" />
        </motion.button>
      </div>

      {/* Session counter */}
      <div className="flex justify-center mb-8">
        <div className="flex items-center gap-2 px-4 py-2 bg-zinc-800/60 rounded-xl">
          <span className="text-lg" role="img" aria-label="tomato">
            {'\uD83C\uDF45'}
          </span>
          <span className="text-sm text-zinc-300">
            <span className="font-semibold text-white">{completedSessions}</span>
            {' '}
            {completedSessions === 1 ? 'session' : 'sessions'} today
          </span>
          {completedSessions >= 4 && (
            <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">
              {'\uD83D\uDD25'} On fire!
            </span>
          )}
        </div>
      </div>

      {/* Task selector */}
      <div className="max-w-md mx-auto">
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setTaskDropdownOpen(prev => !prev)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/50 rounded-xl text-left transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Target className="h-4 w-4 text-zinc-400 shrink-0" />
              {selectedTask ? (
                <span className="text-sm text-zinc-200 truncate">
                  {selectedTask.title}
                </span>
              ) : (
                <span className="text-sm text-zinc-500">
                  Select a task to focus on...
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {selectedTask && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    selectTask(null)
                  }}
                  className="p-0.5 hover:bg-zinc-700 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <ChevronDown className={`h-4 w-4 text-zinc-500 transition-transform duration-200 ${
                taskDropdownOpen ? 'rotate-180' : ''
              }`} />
            </div>
          </button>

          {/* Dropdown list */}
          <AnimatePresence>
            {taskDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scaleY: 0.96 }}
                animate={{ opacity: 1, y: 0, scaleY: 1 }}
                exit={{ opacity: 0, y: -4, scaleY: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute z-50 top-full left-0 right-0 mt-2 bg-zinc-800 border border-zinc-700/50 rounded-xl shadow-xl overflow-hidden"
                style={{ transformOrigin: 'top' }}
              >
                <div className="max-h-64 overflow-y-auto py-1">
                  {isLoading ? (
                    <div className="px-4 py-3 text-sm text-zinc-500">Loading tasks...</div>
                  ) : !tasks || tasks.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-zinc-500">No incomplete tasks</div>
                  ) : (
                    tasks.map(task => (
                      <button
                        key={task.id}
                        onClick={() => selectTask(task.id)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-700/50 transition-colors ${
                          task.id === selectedTaskId ? 'bg-zinc-700/30' : ''
                        }`}
                      >
                        <span className={`shrink-0 ${priorityColor(task.priority)}`}>
                          {task.id === selectedTaskId ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <div className="h-4 w-4 rounded-full border-2 border-current" />
                          )}
                        </span>
                        <span className="text-sm text-zinc-200 truncate">{task.title}</span>
                        {task.duration_minutes && (
                          <span className="ml-auto text-xs text-zinc-500 shrink-0">
                            {task.duration_minutes}m
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Selected task display */}
        <AnimatePresence>
          {selectedTask && !taskDropdownOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 text-center"
            >
              <p className="text-xs text-zinc-500">
                Focusing on
              </p>
              <p className="text-sm text-zinc-300 font-medium">
                {selectedTask.title}
              </p>
              {selectedTask.duration_minutes && (
                <p className="text-xs text-zinc-500 mt-0.5">
                  Estimated: {selectedTask.duration_minutes} min
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="mt-10 text-center">
        <p className="text-xs text-zinc-600">
          Tip: Stay on this page to keep the timer running in the tab title
        </p>
      </div>
    </div>
  )
}
