'use client'

import { useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Repeat,
  Plus,
  Check,
  Flame,
  X,
  Trash2,
  Archive,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import {
  format,
  subDays,
  eachDayOfInterval,
  isToday,
  startOfDay,
  addDays,
} from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'

const supabase = createClient()

// ---------- types ----------
interface Habit {
  id: string
  user_id: string
  name: string
  description: string | null
  color: string | null
  icon: string | null
  frequency_type: string | null
  frequency_days: number[] | null
  target_count: number | null
  reminder_time: string | null
  nag_enabled: boolean | null
  position: number | null
  is_archived: boolean | null
  created_at: string | null
}

interface HabitCompletion {
  id: string
  habit_id: string
  completed_at: string | null
  count: number | null
  date: string | null
}

// ---------- preset colors ----------
const HABIT_COLORS = [
  '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6',
  '#ec4899', '#f59e0b', '#ef4444', '#6366f1',
]

// ---------- frequency types ----------
type FrequencyType = 'daily' | 'every_other_day' | 'weekly' | 'biweekly' | 'monthly' | 'weekdays' | 'custom'

const FREQUENCY_OPTIONS: { value: FrequencyType; label: string; description: string }[] = [
  { value: 'daily', label: 'Daily', description: 'Every day' },
  { value: 'every_other_day', label: 'Every Other Day', description: 'Every 2 days' },
  { value: 'weekly', label: 'Weekly', description: 'Once a week' },
  { value: 'biweekly', label: 'Biweekly', description: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly', description: 'Once a month' },
  { value: 'weekdays', label: 'Weekdays', description: 'Mon through Fri' },
  { value: 'custom', label: 'Custom', description: 'Pick specific days' },
]

const DAY_LABELS = [
  { index: 0, short: 'S', name: 'Sun' },
  { index: 1, short: 'M', name: 'Mon' },
  { index: 2, short: 'T', name: 'Tue' },
  { index: 3, short: 'W', name: 'Wed' },
  { index: 4, short: 'T', name: 'Thu' },
  { index: 5, short: 'F', name: 'Fri' },
  { index: 6, short: 'S', name: 'Sat' },
]

function getFrequencyDescription(frequencyType: string | null, frequencyDays: number[] | null): string {
  switch (frequencyType) {
    case 'daily':
      return 'Daily'
    case 'every_other_day':
      return 'Every other day'
    case 'weekly':
      return 'Weekly'
    case 'biweekly':
      return 'Biweekly'
    case 'monthly':
      return 'Monthly'
    case 'weekdays':
      return 'Mon\u2013Fri'
    case 'custom': {
      if (!frequencyDays || frequencyDays.length === 0) return 'Custom'
      const sorted = [...frequencyDays].sort((a, b) => a - b)
      return sorted.map((d) => DAY_LABELS[d]?.name || '').join(', ')
    }
    default:
      return frequencyType || ''
  }
}

// ---------- hooks ----------
function useHabits() {
  return useQuery({
    queryKey: ['habits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('habits')
        .select('*')
        .eq('is_archived', false)
        .order('position', { ascending: true })
      if (error) throw error
      return (data || []) as Habit[]
    },
  })
}

function useHabitCompletions(habitIds: string[], startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['habit_completions', habitIds, startDate, endDate],
    queryFn: async () => {
      if (habitIds.length === 0) return [] as HabitCompletion[]
      const { data, error } = await supabase
        .from('habit_completions')
        .select('*')
        .in('habit_id', habitIds)
        .gte('date', startDate)
        .lte('date', endDate)
      if (error) throw error
      return (data || []) as HabitCompletion[]
    },
    enabled: habitIds.length > 0,
  })
}

function useCreateHabit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (habit: { name: string; color: string; frequency_type: string; frequency_days?: number[] | null; target_count: number }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('habits')
        .insert({ ...habit, user_id: user.id })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['habits'] }),
  })
}

function useToggleHabitCompletion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ habitId, date, isCompleted }: { habitId: string; date: string; isCompleted: boolean }) => {
      if (isCompleted) {
        // Remove completion
        const { error } = await supabase
          .from('habit_completions')
          .delete()
          .eq('habit_id', habitId)
          .eq('date', date)
        if (error) throw error
      } else {
        // Add completion
        const { error } = await supabase
          .from('habit_completions')
          .insert({ habit_id: habitId, date, count: 1 })
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['habit_completions'] }),
  })
}

function useDeleteHabit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (habitId: string) => {
      // Delete completions first, then habit
      await supabase.from('habit_completions').delete().eq('habit_id', habitId)
      const { error } = await supabase.from('habits').delete().eq('id', habitId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['habits'] })
      qc.invalidateQueries({ queryKey: ['habit_completions'] })
    },
  })
}

function useArchiveHabit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (habitId: string) => {
      const { error } = await supabase
        .from('habits')
        .update({ is_archived: true })
        .eq('id', habitId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['habits'] }),
  })
}

// ---------- streak calculator ----------
function calculateStreak(completions: HabitCompletion[], habitId: string): number {
  const habitCompletions = completions
    .filter((c) => c.habit_id === habitId && c.date)
    .map((c) => c.date!)
  const dateSet = new Set(habitCompletions)

  let streak = 0
  const today = startOfDay(new Date())

  for (let i = 0; i <= 365; i++) {
    const day = format(subDays(today, i), 'yyyy-MM-dd')
    if (i === 0 && !dateSet.has(day)) continue
    if (dateSet.has(day)) {
      streak++
    } else {
      break
    }
  }
  return streak
}

// ---------- Create Habit Dialog ----------
function CreateHabitDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(HABIT_COLORS[0])
  const [frequency, setFrequency] = useState<FrequencyType>('daily')
  const [customDays, setCustomDays] = useState<number[]>([])
  const createHabit = useCreateHabit()

  const toggleDay = (dayIndex: number) => {
    setCustomDays((prev) =>
      prev.includes(dayIndex) ? prev.filter((d) => d !== dayIndex) : [...prev, dayIndex]
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    if (frequency === 'custom' && customDays.length === 0) return
    createHabit.mutate(
      {
        name: name.trim(),
        color,
        frequency_type: frequency,
        frequency_days: frequency === 'custom' ? customDays : frequency === 'weekdays' ? [1, 2, 3, 4, 5] : null,
        target_count: 1,
      },
      { onSuccess: () => onClose() }
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-zinc-100">New Habit</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Meditate, Exercise, Read..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">Color</label>
            <div className="flex gap-2">
              {HABIT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition-all ${
                    color === c ? 'ring-2 ring-offset-2 ring-offset-zinc-900 scale-110' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c, outlineColor: color === c ? c : undefined }}
                />
              ))}
            </div>
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">Frequency</label>
            <div className="grid grid-cols-3 gap-2">
              {FREQUENCY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setFrequency(opt.value)
                    if (opt.value !== 'custom') setCustomDays([])
                  }}
                  className={`py-2 px-2 rounded-lg text-sm font-medium transition-all text-center ${
                    frequency === opt.value
                      ? 'bg-emerald-600 text-white ring-1 ring-emerald-500'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {/* Description of selected frequency */}
            <p className="text-xs text-zinc-500 mt-2">
              {FREQUENCY_OPTIONS.find((o) => o.value === frequency)?.description}
            </p>
          </div>

          {/* Custom day picker */}
          <AnimatePresence>
            {frequency === 'custom' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Select days</label>
                  <div className="flex gap-2 justify-between">
                    {DAY_LABELS.map((day) => (
                      <button
                        key={day.index}
                        type="button"
                        onClick={() => toggleDay(day.index)}
                        title={day.name}
                        className={`w-9 h-9 rounded-full text-xs font-semibold transition-all flex items-center justify-center ${
                          customDays.includes(day.index)
                            ? 'bg-emerald-600 text-white ring-1 ring-emerald-400'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300 border border-zinc-700'
                        }`}
                      >
                        {day.short}
                      </button>
                    ))}
                  </div>
                  {customDays.length > 0 && (
                    <p className="text-xs text-emerald-400/80 mt-2">
                      {[...customDays].sort((a, b) => a - b).map((d) => DAY_LABELS[d]?.name).join(', ')}
                    </p>
                  )}
                  {customDays.length === 0 && (
                    <p className="text-xs text-amber-400/80 mt-2">
                      Pick at least one day
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || createHabit.isPending || (frequency === 'custom' && customDays.length === 0)}
              className="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors disabled:opacity-50"
            >
              {createHabit.isPending ? 'Creating...' : 'Create Habit'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ---------- Habit Row ----------
function HabitRow({
  habit,
  days,
  completionsByDate,
  streak,
}: {
  habit: Habit
  days: Date[]
  completionsByDate: Map<string, boolean>
  streak: number
}) {
  const toggleCompletion = useToggleHabitCompletion()
  const deleteHabit = useDeleteHabit()
  const archiveHabit = useArchiveHabit()
  const [showMenu, setShowMenu] = useState(false)

  const habitColor = habit.color || '#10b981'
  const completedCount = Array.from(completionsByDate.values()).filter(Boolean).length

  return (
    <div className="group bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 hover:border-zinc-600/50 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: habitColor }}
          />
          <span className="text-sm font-medium text-zinc-200 truncate">{habit.name}</span>
          <span className="text-[11px] text-zinc-500 shrink-0 bg-zinc-800 px-2 py-0.5 rounded-full">
            {getFrequencyDescription(habit.frequency_type, habit.frequency_days)}
          </span>
          {streak > 0 && (
            <span className="flex items-center gap-1 text-xs text-orange-400 shrink-0">
              <Flame className="h-3 w-3" />
              {streak}d
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">
            {completedCount}/{days.length}
          </span>
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-8 z-50 bg-zinc-800 border border-zinc-700 rounded-lg py-1 shadow-xl min-w-[140px]">
                  <button
                    onClick={() => { archiveHabit.mutate(habit.id); setShowMenu(false) }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
                  >
                    <Archive className="h-3.5 w-3.5" />
                    Archive
                  </button>
                  <button
                    onClick={() => { deleteHabit.mutate(habit.id); setShowMenu(false) }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-zinc-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Day circles */}
      <div className="flex gap-1.5 justify-between">
        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd')
          const completed = completionsByDate.get(dateStr) || false
          const today = isToday(day)

          return (
            <button
              key={dateStr}
              onClick={() =>
                toggleCompletion.mutate({
                  habitId: habit.id,
                  date: dateStr,
                  isCompleted: completed,
                })
              }
              className={`flex flex-col items-center gap-1 group/day`}
            >
              <span className={`text-[10px] ${today ? 'text-emerald-400 font-medium' : 'text-zinc-500'}`}>
                {today ? 'Today' : format(day, 'EEE').charAt(0)}
              </span>
              <motion.div
                whileTap={{ scale: 0.85 }}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border ${
                  completed
                    ? 'border-transparent'
                    : today
                    ? 'border-zinc-600 hover:border-emerald-500/50'
                    : 'border-zinc-700/50 hover:border-zinc-600'
                }`}
                style={
                  completed
                    ? { backgroundColor: habitColor }
                    : undefined
                }
              >
                {completed && (
                  <Check className="h-4 w-4 text-white" strokeWidth={3} />
                )}
              </motion.div>
              <span className={`text-[10px] ${today ? 'text-zinc-300' : 'text-zinc-600'}`}>
                {format(day, 'd')}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------- Weekly Heatmap (past 12 weeks) ----------
function HabitsHeatmap({
  habits,
  completions,
}: {
  habits: Habit[]
  completions: HabitCompletion[]
}) {
  const days = useMemo(() => {
    const end = new Date()
    const start = subDays(end, 83) // 12 weeks
    return eachDayOfInterval({ start, end })
  }, [])

  const countByDay = useMemo(() => {
    const map = new Map<string, number>()
    completions.forEach((c) => {
      if (c.date) {
        map.set(c.date, (map.get(c.date) || 0) + 1)
      }
    })
    return map
  }, [completions])

  const maxCount = Math.max(1, ...Array.from(countByDay.values()))

  function getColor(count: number) {
    if (count === 0) return 'bg-zinc-800'
    const ratio = count / maxCount
    if (ratio <= 0.25) return 'bg-emerald-900/60'
    if (ratio <= 0.5) return 'bg-emerald-700/70'
    if (ratio <= 0.75) return 'bg-emerald-600/80'
    return 'bg-emerald-500'
  }

  const weeks: Date[][] = []
  let currentWeek: Date[] = []
  days.forEach((day) => {
    if (day.getDay() === 0 && currentWeek.length > 0) {
      weeks.push(currentWeek)
      currentWeek = []
    }
    currentWeek.push(day)
  })
  if (currentWeek.length > 0) weeks.push(currentWeek)

  return (
    <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-5">
      <h3 className="text-sm font-medium text-zinc-300 mb-4 flex items-center gap-2">
        <Flame className="h-4 w-4 text-orange-400" />
        Activity Heatmap (12 weeks)
      </h3>
      <div className="flex gap-[3px] justify-center overflow-x-auto">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd')
              const count = countByDay.get(dateStr) || 0
              return (
                <div
                  key={dateStr}
                  className={`w-[14px] h-[14px] rounded-sm ${getColor(count)} ${
                    isToday(day) ? 'ring-1 ring-emerald-400' : ''
                  }`}
                  title={`${format(day, 'MMM d')}: ${count} habit${count !== 1 ? 's' : ''} completed`}
                />
              )
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-2 mt-3 text-xs text-zinc-500">
        <span>Less</span>
        <div className="w-3 h-3 rounded-sm bg-zinc-800" />
        <div className="w-3 h-3 rounded-sm bg-emerald-900/60" />
        <div className="w-3 h-3 rounded-sm bg-emerald-700/70" />
        <div className="w-3 h-3 rounded-sm bg-emerald-600/80" />
        <div className="w-3 h-3 rounded-sm bg-emerald-500" />
        <span>More</span>
      </div>
    </div>
  )
}

// ---------- Main Page ----------
export default function HabitsPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)

  // Week days for the tracker row
  const weekDays = useMemo(() => {
    const today = startOfDay(new Date())
    const startOfThisWeek = subDays(today, today.getDay()) // Sunday
    const offsetStart = addDays(startOfThisWeek, weekOffset * 7)
    return eachDayOfInterval({
      start: offsetStart,
      end: addDays(offsetStart, 6),
    })
  }, [weekOffset])

  // Date range for completions: 12 weeks back for heatmap + current week
  const dateRange = useMemo(() => {
    const heatmapStart = format(subDays(new Date(), 83), 'yyyy-MM-dd')
    const weekEnd = format(weekDays[weekDays.length - 1], 'yyyy-MM-dd')
    const weekStart = format(weekDays[0], 'yyyy-MM-dd')
    const start = heatmapStart < weekStart ? heatmapStart : weekStart
    const end = weekEnd > format(new Date(), 'yyyy-MM-dd') ? weekEnd : format(new Date(), 'yyyy-MM-dd')
    return { start, end }
  }, [weekDays])

  const { data: habits = [], isLoading: loadingHabits } = useHabits()
  const habitIds = useMemo(() => habits.map((h) => h.id), [habits])
  const { data: completions = [] } = useHabitCompletions(
    habitIds,
    dateRange.start,
    dateRange.end
  )

  // Per-habit completion maps for the current week
  const habitCompletionMaps = useMemo(() => {
    const maps = new Map<string, Map<string, boolean>>()
    habits.forEach((h) => {
      const dayMap = new Map<string, boolean>()
      weekDays.forEach((d) => dayMap.set(format(d, 'yyyy-MM-dd'), false))
      maps.set(h.id, dayMap)
    })
    completions.forEach((c) => {
      if (c.date) {
        const dayMap = maps.get(c.habit_id)
        if (dayMap && dayMap.has(c.date)) {
          dayMap.set(c.date, true)
        }
      }
    })
    return maps
  }, [habits, completions, weekDays])

  // Today's progress
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const todayCompleted = useMemo(() => {
    return completions.filter((c) => c.date === todayStr).length
  }, [completions, todayStr])

  const isCurrentWeek = weekOffset === 0

  if (loadingHabits) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Repeat className="h-6 w-6 text-emerald-500" />
          <h1 className="text-2xl font-bold text-zinc-100">Habits</h1>
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 animate-pulse h-28" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Repeat className="h-6 w-6 text-emerald-500" />
            <h1 className="text-2xl font-bold text-zinc-100">Habits</h1>
          </div>
          <p className="text-sm text-zinc-400 ml-9">
            {habits.length === 0
              ? 'Build lasting habits one day at a time'
              : `${todayCompleted}/${habits.length} completed today`}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Habit
        </button>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setWeekOffset((w) => w - 1)}
          className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-sm text-zinc-300 font-medium">
          {format(weekDays[0], 'MMM d')} - {format(weekDays[6], 'MMM d, yyyy')}
          {isCurrentWeek && (
            <span className="ml-2 text-emerald-400 text-xs">(This week)</span>
          )}
        </div>
        <button
          onClick={() => setWeekOffset((w) => w + 1)}
          disabled={isCurrentWeek}
          className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Habit Rows */}
      {habits.length === 0 ? (
        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-12 text-center">
          <Repeat className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400 mb-1">No habits yet</p>
          <p className="text-sm text-zinc-500 mb-4">
            Start building consistency by creating your first habit
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
          >
            Create First Habit
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {habits.map((habit) => (
            <HabitRow
              key={habit.id}
              habit={habit}
              days={weekDays}
              completionsByDate={habitCompletionMaps.get(habit.id) || new Map()}
              streak={calculateStreak(completions, habit.id)}
            />
          ))}
        </div>
      )}

      {/* Heatmap */}
      {habits.length > 0 && (
        <HabitsHeatmap habits={habits} completions={completions} />
      )}

      {/* Create Dialog */}
      <AnimatePresence>
        {showCreate && <CreateHabitDialog onClose={() => setShowCreate(false)} />}
      </AnimatePresence>
    </div>
  )
}
