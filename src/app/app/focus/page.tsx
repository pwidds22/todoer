'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useFocusTimer } from '@/hooks/useFocusTimer'
import { useTasks } from '@/hooks/useTasks'
import { DEFAULT_FOCUS_SETTINGS, type FocusSettings, type SessionType } from '@/lib/focus-timer'
import { Timer, Play, Pause, RotateCcw, Coffee, Target, ChevronDown, Check, X, Settings } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// --- Types ---

interface SessionConfig {
  label: string
  minutes: number
  color: string
  icon: React.ReactNode
}

// --- Constants ---

function buildSessionConfigs(settings: FocusSettings): Record<SessionType, SessionConfig> {
  return {
    focus: { label: 'Focus', minutes: settings.focusMinutes, color: '#7c3aed', icon: <Target className="h-4 w-4" /> },
    shortBreak: { label: 'Short Break', minutes: settings.shortBreakMinutes, color: '#22c55e', icon: <Coffee className="h-4 w-4" /> },
    longBreak: { label: 'Long Break', minutes: settings.longBreakMinutes, color: '#3b82f6', icon: <Coffee className="h-4 w-4" /> },
  }
}

const CIRCLE_RADIUS = 120
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS

// --- Audio ---

function playCompletionSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    const audioCtx = new AudioContextClass()

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
    window.setTimeout(() => { void audioCtx.close().catch(() => {}) }, 1200)
  } catch {
    // AudioContext not available
  }
}

// --- Component ---

export default function FocusPage() {
  const { user } = useAuth()
  const { data: tasks, isLoading } = useTasks({ isCompleted: false })
  const { state, ready, persistenceError, timeLeft, completedSessions, dispatch } = useFocusTimer(user?.id ?? null, playCompletionSound)
  const { settings, session, lastCompletion } = state
  const sessionType = session.type
  const isRunning = session.status === 'running'
  const selectedTaskId = session.taskId
  const sessionJustCompleted = lastCompletion !== null

  const [settingsOpen, setSettingsOpen] = useState(false)
  const pendingSettings = settings
  const sessionConfigs = useMemo(() => buildSessionConfigs(settings), [settings])
  const [taskDropdownOpen, setTaskDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const settingsPanelRef = useRef<HTMLDivElement>(null)

  const totalSeconds = session.durationMs / 1000
  const progress = (totalSeconds - timeLeft) / totalSeconds
  const dashOffset = CIRCLE_CIRCUMFERENCE * (1 - progress)

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const displayTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  const activeColor = sessionConfigs[sessionType].color

  const selectedTask = tasks?.find(t => t.id === selectedTaskId)

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

  // Close settings panel on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (settingsPanelRef.current && !settingsPanelRef.current.contains(e.target as Node)) {
        setSettingsOpen(false)
      }
    }
    if (settingsOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [settingsOpen])

  function handleResetDefaults() {
    dispatch({ type: 'settings', settings: DEFAULT_FOCUS_SETTINGS })
  }

  function handleSettingChange<K extends keyof FocusSettings>(key: K, value: FocusSettings[K]) {
    dispatch({ type: 'settings', settings: { [key]: value } })
  }

  // Update document title with timer
  useEffect(() => {
    if (isRunning) {
      document.title = `${displayTime} - ${sessionConfigs[sessionType].label} | Todoer`
    } else {
      document.title = 'Focus | Todoer'
    }
    return () => { document.title = 'Todoer' }
  }, [displayTime, isRunning, sessionType, sessionConfigs])

  function switchSession(type: SessionType) {
    dispatch({ type: 'switch', sessionType: type })
  }

  function toggleTimer() {
    dispatch({ type: isRunning ? 'pause' : 'start' })
  }

  function resetTimer() {
    dispatch({ type: 'reset' })
  }

  function selectTask(taskId: string | null) {
    dispatch({ type: 'task', taskId })
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
      <div className="mb-8 relative">
        <div className="flex items-center gap-3 mb-1">
          <Timer className="h-6 w-6 text-purple-500" />
          <h1 className="text-2xl font-bold">Focus</h1>
          <button
            onClick={() => setSettingsOpen(prev => !prev)}
            disabled={!ready}
            className="ml-auto p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Timer settings"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground ml-9">
          Stay focused with the Pomodoro technique
        </p>

        {/* Settings Panel */}
        <AnimatePresence>
          {settingsOpen && (
            <motion.div
              ref={settingsPanelRef}
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="absolute right-0 top-full mt-2 z-50 w-80 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden"
            >
              {/* Panel header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700/50">
                <h3 className="text-sm font-semibold text-zinc-200">Timer Settings</h3>
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Panel body */}
              <div className="p-4 space-y-5">
                {/* Focus duration */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Focus Duration</label>
                    <span className="text-sm font-mono text-purple-400">{pendingSettings.focusMinutes} min</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={60}
                    value={pendingSettings.focusMinutes}
                    onChange={(e) => handleSettingChange('focusMinutes', Number(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-zinc-700 accent-purple-500
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer
                      [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-purple-500 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-600 mt-0.5">
                    <span>1</span>
                    <span>60</span>
                  </div>
                </div>

                {/* Short break duration */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Short Break</label>
                    <span className="text-sm font-mono text-green-400">{pendingSettings.shortBreakMinutes} min</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={30}
                    value={pendingSettings.shortBreakMinutes}
                    onChange={(e) => handleSettingChange('shortBreakMinutes', Number(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-zinc-700 accent-green-500
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-green-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer
                      [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-green-500 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-600 mt-0.5">
                    <span>1</span>
                    <span>30</span>
                  </div>
                </div>

                {/* Long break duration */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Long Break</label>
                    <span className="text-sm font-mono text-blue-400">{pendingSettings.longBreakMinutes} min</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={60}
                    value={pendingSettings.longBreakMinutes}
                    onChange={(e) => handleSettingChange('longBreakMinutes', Number(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-zinc-700 accent-blue-500
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer
                      [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-600 mt-0.5">
                    <span>1</span>
                    <span>60</span>
                  </div>
                </div>

                {/* Long break interval */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Long Break Every</label>
                    <span className="text-sm font-mono text-zinc-300">{pendingSettings.longBreakInterval} sessions</span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={10}
                    value={pendingSettings.longBreakInterval}
                    onChange={(e) => handleSettingChange('longBreakInterval', Number(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-zinc-700 accent-purple-500
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer
                      [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-purple-500 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-600 mt-0.5">
                    <span>2</span>
                    <span>10</span>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-zinc-700/50" />

                {/* Auto-start breaks */}
                <div className="flex items-center justify-between">
                  <label className="text-sm text-zinc-300">Auto-start breaks</label>
                  <button
                    onClick={() => handleSettingChange('autoStartBreaks', !pendingSettings.autoStartBreaks)}
                    role="switch"
                    aria-label="Auto-start breaks"
                    aria-checked={pendingSettings.autoStartBreaks}
                    className={`relative w-10 h-[22px] rounded-full transition-colors duration-200 ${
                      pendingSettings.autoStartBreaks ? 'bg-purple-500' : 'bg-zinc-700'
                    }`}
                  >
                    <motion.div
                      className="absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white shadow-sm"
                      animate={{ x: pendingSettings.autoStartBreaks ? 18 : 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>

                {/* Auto-start focus */}
                <div className="flex items-center justify-between">
                  <label className="text-sm text-zinc-300">Auto-start focus</label>
                  <button
                    onClick={() => handleSettingChange('autoStartFocus', !pendingSettings.autoStartFocus)}
                    role="switch"
                    aria-label="Auto-start focus"
                    aria-checked={pendingSettings.autoStartFocus}
                    className={`relative w-10 h-[22px] rounded-full transition-colors duration-200 ${
                      pendingSettings.autoStartFocus ? 'bg-purple-500' : 'bg-zinc-700'
                    }`}
                  >
                    <motion.div
                      className="absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white shadow-sm"
                      animate={{ x: pendingSettings.autoStartFocus ? 18 : 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>
                <p className="text-xs text-zinc-500">
                  Auto-start works while this page is active. Returning after a session ends leaves the next session paused.
                </p>
                <p className="text-xs text-zinc-500">
                  Duration changes apply to the next session. Reset the timer to use them now.
                </p>
              </div>

              {/* Panel footer */}
              <div className="px-4 py-3 border-t border-zinc-700/50">
                <button
                  onClick={handleResetDefaults}
                  className="w-full text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 py-2 rounded-lg transition-colors"
                >
                  Reset to defaults
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {persistenceError && (
        <p role="alert" className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Timer changes could not be saved on this device. Keep this page open; recovery and reminder pausing may be unavailable.
        </p>
      )}

      {/* Session type toggle */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex bg-zinc-800/60 rounded-xl p-1 gap-1">
          {(Object.keys(sessionConfigs) as SessionType[]).map(type => (
            <button
              key={type}
              onClick={() => {
                if (!isRunning) switchSession(type)
              }}
              disabled={!ready || isRunning}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                sessionType === type
                  ? 'bg-zinc-700 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
              } ${isRunning && sessionType !== type ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {sessionConfigs[type].icon}
              {sessionConfigs[type].label}
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
              {sessionConfigs[sessionType].label}
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
              role="status"
            >
              {lastCompletion && sessionConfigs[lastCompletion.type].label} complete. {sessionConfigs[sessionType].label} {isRunning ? 'started.' : 'ready when you are.'}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 mb-8">
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={resetTimer}
          disabled={!ready}
          className="p-3 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
          title="Reset"
        >
          <RotateCcw className="h-5 w-5" />
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={toggleTimer}
          disabled={!ready}
          className="p-5 rounded-full text-white shadow-lg transition-all duration-200"
          style={{ backgroundColor: activeColor }}
          title={isRunning ? 'Pause' : 'Start'}
          aria-label={isRunning ? 'Pause timer' : 'Start timer'}
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
          tabIndex={-1}
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
            disabled={!ready}
            aria-expanded={taskDropdownOpen}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 pr-12 bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/50 rounded-xl text-left transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Target className="h-4 w-4 text-zinc-400 shrink-0" />
              {selectedTask ? (
                <span className="text-sm text-zinc-200 truncate">
                  {selectedTask.title}
                </span>
              ) : (
                <span className="text-sm text-zinc-500">
                  {selectedTaskId ? isLoading ? 'Loading linked task...' : 'Linked task unavailable' : 'Select a task to focus on...'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ChevronDown className={`h-4 w-4 text-zinc-500 transition-transform duration-200 ${
                taskDropdownOpen ? 'rotate-180' : ''
              }`} />
            </div>
          </button>
          {selectedTaskId && (
            <button
              onClick={() => selectTask(null)}
              aria-label="Unlink focused task"
              className="absolute right-3 top-3 p-1 hover:bg-zinc-700 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

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
              {isRunning && sessionType === 'focus' && !persistenceError && (
                <p className="text-xs text-purple-400 mt-2">
                  Reminders for this task pause during this focus session.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="mt-10 text-center">
        <p className="text-xs text-zinc-600">
          Your timer restores when you return. Sound and auto-start work while this page is open and active.
        </p>
      </div>
    </div>
  )
}
