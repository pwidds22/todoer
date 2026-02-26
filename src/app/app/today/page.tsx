'use client'

import { useMemo } from 'react'
import { useTodayTasks } from '@/hooks/useTasks'
import { TaskList } from '@/components/tasks/TaskList'
import { QuickAdd } from '@/components/tasks/QuickAdd'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, startOfDay, subDays } from 'date-fns'
import { Sun, Repeat, Check, Flame, ArrowRight, Clock } from 'lucide-react'
import Link from 'next/link'

const supabase = createClient()

// ---------- types ----------
interface Habit {
  id: string
  user_id: string
  name: string
  color: string | null
  frequency_type: string | null
  reminder_time: string | null
  is_archived: boolean | null
  created_at: string | null
}

interface HabitCompletion {
  id: string
  habit_id: string
  date: string | null
  count: number | null
  completed_at: string | null
}

// ---------- hooks ----------
function useTodayHabits() {
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

function useTodayHabitCompletions(habitIds: string[]) {
  const todayStr = format(startOfDay(new Date()), 'yyyy-MM-dd')
  return useQuery({
    queryKey: ['habit_completions', habitIds, todayStr, todayStr],
    queryFn: async () => {
      if (habitIds.length === 0) return [] as HabitCompletion[]
      const { data, error } = await supabase
        .from('habit_completions')
        .select('*')
        .in('habit_id', habitIds)
        .eq('date', todayStr)
      if (error) throw error
      return (data || []) as HabitCompletion[]
    },
    enabled: habitIds.length > 0,
  })
}

function useStreakCompletions(habitIds: string[]) {
  const todayStr = format(startOfDay(new Date()), 'yyyy-MM-dd')
  const yearAgo = format(subDays(new Date(), 365), 'yyyy-MM-dd')
  return useQuery({
    queryKey: ['habit_completions', habitIds, yearAgo, todayStr],
    queryFn: async () => {
      if (habitIds.length === 0) return [] as HabitCompletion[]
      const { data, error } = await supabase
        .from('habit_completions')
        .select('*')
        .in('habit_id', habitIds)
        .gte('date', yearAgo)
        .lte('date', todayStr)
      if (error) throw error
      return (data || []) as HabitCompletion[]
    },
    enabled: habitIds.length > 0,
  })
}

function useToggleHabitCompletion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ habitId, date, isCompleted }: { habitId: string; date: string; isCompleted: boolean }) => {
      if (isCompleted) {
        const { error } = await supabase
          .from('habit_completions')
          .delete()
          .eq('habit_id', habitId)
          .eq('date', date)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('habit_completions')
          .insert({ habit_id: habitId, date, count: 1 })
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['habit_completions'] }),
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

// ---------- Habit Row for Today ----------
function TodayHabitRow({
  habit,
  isCompleted,
  streak,
}: {
  habit: Habit
  isCompleted: boolean
  streak: number
}) {
  const toggleCompletion = useToggleHabitCompletion()
  const todayStr = format(startOfDay(new Date()), 'yyyy-MM-dd')
  const habitColor = habit.color || '#10b981'

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl hover:border-zinc-600/50 transition-colors">
      {/* Colored dot */}
      <div
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: habitColor }}
      />

      {/* Habit name + time */}
      <div className="flex-1 min-w-0">
        <span className={`text-sm ${isCompleted ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>
          {habit.name}
        </span>
        {habit.reminder_time && (
          <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-zinc-500">
            <Clock className="h-3 w-3" />
            {(() => {
              const [h, m] = habit.reminder_time.split(':').map(Number)
              const ampm = h >= 12 ? 'PM' : 'AM'
              const h12 = h % 12 || 12
              return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
            })()}
          </span>
        )}
      </div>

      {/* Streak */}
      {streak > 0 && (
        <span className="flex items-center gap-1 text-xs text-orange-400 shrink-0">
          <Flame className="h-3 w-3" />
          {streak}d
        </span>
      )}

      {/* Toggle checkbox */}
      <button
        onClick={() =>
          toggleCompletion.mutate({
            habitId: habit.id,
            date: todayStr,
            isCompleted,
          })
        }
        disabled={toggleCompletion.isPending}
        className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all shrink-0 ${
          isCompleted
            ? 'border-transparent'
            : 'border-zinc-600 hover:border-emerald-500/60'
        } ${toggleCompletion.isPending ? 'opacity-50' : ''}`}
        style={isCompleted ? { backgroundColor: habitColor } : undefined}
      >
        {isCompleted && (
          <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
        )}
      </button>
    </div>
  )
}

// ---------- Main Page ----------
export default function TodayPage() {
  const { data: tasks, isLoading: loadingTasks } = useTodayTasks()
  const { data: habits = [], isLoading: loadingHabits } = useTodayHabits()

  const habitIds = useMemo(() => habits.map((h) => h.id), [habits])
  const { data: todayCompletions = [] } = useTodayHabitCompletions(habitIds)
  const { data: streakCompletions = [] } = useStreakCompletions(habitIds)

  const todayStr = format(startOfDay(new Date()), 'yyyy-MM-dd')

  // Set of habit IDs completed today
  const completedHabitIds = useMemo(() => {
    return new Set(
      todayCompletions
        .filter((c) => c.date === todayStr)
        .map((c) => c.habit_id)
    )
  }, [todayCompletions, todayStr])

  const completedCount = completedHabitIds.size
  const totalHabits = habits.length

  const today = new Date()
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Sun className="h-6 w-6 text-yellow-500" />
          <h1 className="text-2xl font-bold">Today</h1>
        </div>
        <p className="text-sm text-muted-foreground ml-9">{dateStr}</p>
      </div>

      {/* Quick Add */}
      <div className="mb-4">
        <QuickAdd />
      </div>

      {/* Tasks Section */}
      {loadingTasks ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-accent/30 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <TaskList
          tasks={tasks || []}
          groupBy="date"
          emptyMessage="All clear for today! Add a task or enjoy your free time."
        />
      )}

      {/* Today's Habits Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Repeat className="h-4 w-4 text-emerald-500" />
            <h2 className="text-base font-semibold text-zinc-200">Today&apos;s Habits</h2>
            {totalHabits > 0 && (
              <span className="text-xs text-zinc-500 ml-1">
                {completedCount}/{totalHabits} completed
              </span>
            )}
          </div>
          <Link
            href="/app/habits"
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-emerald-400 transition-colors"
          >
            View all habits
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {loadingHabits ? (
          <div className="space-y-2">
            {[1, 2].map(i => (
              <div key={i} className="h-14 bg-zinc-800/50 border border-zinc-700/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : habits.length === 0 ? (
          <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-6 text-center">
            <Repeat className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
            <p className="text-sm text-zinc-400 mb-1">No habits yet</p>
            <Link
              href="/app/habits"
              className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Create your first habit
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {habits.map((habit) => (
              <TodayHabitRow
                key={habit.id}
                habit={habit}
                isCompleted={completedHabitIds.has(habit.id)}
                streak={calculateStreak(streakCompletions, habit.id)}
              />
            ))}

            {/* Progress bar */}
            {totalHabits > 0 && (
              <div className="mt-3 px-1">
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${(completedCount / totalHabits) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
