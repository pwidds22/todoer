'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3,
  CheckCircle2,
  Clock,
  Flame,
  Trophy,
  TrendingUp,
  Calendar,
  Target,
} from 'lucide-react'
import {
  format,
  subDays,
  startOfDay,
  eachDayOfInterval,
  isSameDay,
  isToday,
  startOfWeek,
  endOfWeek,
} from 'date-fns'

const supabase = createClient()

function useCompletedTasks(days: number) {
  const since = subDays(new Date(), days).toISOString()
  return useQuery({
    queryKey: ['stats', 'completed', days],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, completed_at, priority, created_at, due_date')
        .eq('is_completed', true)
        .eq('is_deleted', false)
        .gte('completed_at', since)
        .order('completed_at', { ascending: false })

      if (error) throw error
      return data || []
    },
  })
}

function useAllTaskCounts() {
  return useQuery({
    queryKey: ['stats', 'counts'],
    queryFn: async () => {
      const { count: total } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('is_deleted', false)

      const { count: completed } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('is_deleted', false)
        .eq('is_completed', true)

      const { count: active } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('is_deleted', false)
        .eq('is_completed', false)

      const today = new Date().toISOString().split('T')[0]
      const { count: overdue } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('is_deleted', false)
        .eq('is_completed', false)
        .lt('due_date', today)

      return {
        total: total || 0,
        completed: completed || 0,
        active: active || 0,
        overdue: overdue || 0,
      }
    },
  })
}

function StatCard({
  icon,
  label,
  value,
  color,
  subtitle,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  color: string
  subtitle?: string
}) {
  return (
    <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
        <span className="text-sm text-zinc-400">{label}</span>
      </div>
      <p className="text-3xl font-bold text-zinc-100">{value}</p>
      {subtitle && <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>}
    </div>
  )
}

function CompletionHeatmap({ tasks }: { tasks: any[] }) {
  const days = useMemo(() => {
    const end = new Date()
    const start = subDays(end, 27) // 4 weeks
    return eachDayOfInterval({ start, end })
  }, [])

  const countByDay = useMemo(() => {
    const map = new Map<string, number>()
    tasks.forEach((t) => {
      if (t.completed_at) {
        const day = t.completed_at.split('T')[0]
        map.set(day, (map.get(day) || 0) + 1)
      }
    })
    return map
  }, [tasks])

  const maxCount = Math.max(1, ...Array.from(countByDay.values()))

  function getColor(count: number) {
    if (count === 0) return 'bg-zinc-800'
    const ratio = count / maxCount
    if (ratio <= 0.25) return 'bg-violet-900/60'
    if (ratio <= 0.5) return 'bg-violet-700/70'
    if (ratio <= 0.75) return 'bg-violet-600/80'
    return 'bg-violet-500'
  }

  // Group days into weeks (columns)
  const weeks: Date[][] = []
  let currentWeek: Date[] = []
  days.forEach((day, i) => {
    const dayOfWeek = day.getDay()
    if (dayOfWeek === 0 && currentWeek.length > 0) {
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
        Completion Activity (4 weeks)
      </h3>
      <div className="flex gap-1 justify-center">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd')
              const count = countByDay.get(dateStr) || 0
              return (
                <div
                  key={dateStr}
                  className={`w-5 h-5 rounded-sm ${getColor(count)} ${
                    isToday(day) ? 'ring-1 ring-violet-400' : ''
                  }`}
                  title={`${format(day, 'MMM d')}: ${count} tasks`}
                />
              )
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-2 mt-3 text-xs text-zinc-500">
        <span>Less</span>
        <div className="w-3 h-3 rounded-sm bg-zinc-800" />
        <div className="w-3 h-3 rounded-sm bg-violet-900/60" />
        <div className="w-3 h-3 rounded-sm bg-violet-700/70" />
        <div className="w-3 h-3 rounded-sm bg-violet-600/80" />
        <div className="w-3 h-3 rounded-sm bg-violet-500" />
        <span>More</span>
      </div>
    </div>
  )
}

function DailyBarChart({ tasks }: { tasks: any[] }) {
  const days = useMemo(() => {
    const end = new Date()
    const start = subDays(end, 6)
    return eachDayOfInterval({ start, end })
  }, [])

  const countByDay = useMemo(() => {
    const map = new Map<string, number>()
    tasks.forEach((t) => {
      if (t.completed_at) {
        const day = t.completed_at.split('T')[0]
        map.set(day, (map.get(day) || 0) + 1)
      }
    })
    return map
  }, [tasks])

  const maxCount = Math.max(1, ...days.map((d) => countByDay.get(format(d, 'yyyy-MM-dd')) || 0))

  return (
    <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-5">
      <h3 className="text-sm font-medium text-zinc-300 mb-4 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-blue-400" />
        Daily Completions (7 days)
      </h3>
      <div className="flex items-end gap-2 h-32">
        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd')
          const count = countByDay.get(dateStr) || 0
          const height = maxCount > 0 ? (count / maxCount) * 100 : 0
          return (
            <div key={dateStr} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs text-zinc-400">{count}</span>
              <div
                className={`w-full rounded-t-md transition-all ${
                  isToday(day) ? 'bg-violet-500' : 'bg-violet-600/50'
                }`}
                style={{ height: `${Math.max(height, 4)}%` }}
              />
              <span className="text-[10px] text-zinc-500">
                {isToday(day) ? 'Today' : format(day, 'EEE')}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StreakCounter({ tasks }: { tasks: any[] }) {
  const streak = useMemo(() => {
    let count = 0
    const today = startOfDay(new Date())

    for (let i = 0; i <= 365; i++) {
      const day = subDays(today, i)
      const dateStr = format(day, 'yyyy-MM-dd')
      const completed = tasks.some(
        (t) => t.completed_at && t.completed_at.startsWith(dateStr)
      )

      // Skip today if nothing completed yet
      if (i === 0 && !completed) continue
      if (completed) {
        count++
      } else {
        break
      }
    }
    return count
  }, [tasks])

  return (
    <StatCard
      icon={<Flame className="h-5 w-5 text-orange-400" />}
      label="Current Streak"
      value={`${streak} day${streak !== 1 ? 's' : ''}`}
      color="bg-orange-500/10"
      subtitle={streak >= 7 ? '🔥 On fire!' : streak > 0 ? 'Keep it going!' : 'Complete a task to start'}
    />
  )
}

function PriorityBreakdown({ tasks }: { tasks: any[] }) {
  const breakdown = useMemo(() => {
    const counts = { urgent: 0, high: 0, medium: 0, low: 0, none: 0 }
    tasks.forEach((t) => {
      switch (t.priority) {
        case 1: counts.urgent++; break
        case 2: counts.high++; break
        case 3: counts.medium++; break
        case 4: counts.low++; break
        default: counts.none++; break
      }
    })
    return counts
  }, [tasks])

  const total = tasks.length || 1
  const items = [
    { label: 'Urgent', count: breakdown.urgent, color: 'bg-red-500' },
    { label: 'High', count: breakdown.high, color: 'bg-orange-500' },
    { label: 'Medium', count: breakdown.medium, color: 'bg-amber-500' },
    { label: 'Low', count: breakdown.low, color: 'bg-blue-500' },
    { label: 'None', count: breakdown.none, color: 'bg-zinc-500' },
  ]

  return (
    <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-5">
      <h3 className="text-sm font-medium text-zinc-300 mb-4 flex items-center gap-2">
        <Target className="h-4 w-4 text-violet-400" />
        Completed by Priority
      </h3>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <span className="text-xs text-zinc-400 w-12">{item.label}</span>
            <div className="flex-1 bg-zinc-700/50 rounded-full h-2.5">
              <div
                className={`h-full rounded-full ${item.color} transition-all`}
                style={{ width: `${(item.count / total) * 100}%` }}
              />
            </div>
            <span className="text-xs text-zinc-400 w-6 text-right">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function StatsPage() {
  const { data: completedTasks = [], isLoading: loadingTasks } = useCompletedTasks(30)
  const { data: counts, isLoading: loadingCounts } = useAllTaskCounts()

  const todayCompleted = useMemo(() => {
    return completedTasks.filter(
      (t) => t.completed_at && isToday(new Date(t.completed_at))
    ).length
  }, [completedTasks])

  if (loadingTasks || loadingCounts) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <BarChart3 className="h-6 w-6 text-indigo-500" />
          <h1 className="text-2xl font-bold">Stats</h1>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-5 animate-pulse h-28" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-indigo-500" />
          <h1 className="text-2xl font-bold">Stats</h1>
        </div>
        <p className="text-sm text-zinc-400 ml-9">Your productivity at a glance</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-400" />}
          label="Completed Today"
          value={todayCompleted}
          color="bg-emerald-500/10"
        />
        <StatCard
          icon={<Trophy className="h-5 w-5 text-amber-400" />}
          label="Total Completed"
          value={counts?.completed || 0}
          color="bg-amber-500/10"
        />
        <StatCard
          icon={<Clock className="h-5 w-5 text-blue-400" />}
          label="Active Tasks"
          value={counts?.active || 0}
          color="bg-blue-500/10"
          subtitle={counts?.overdue ? `${counts.overdue} overdue` : undefined}
        />
        <StreakCounter tasks={completedTasks} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DailyBarChart tasks={completedTasks} />
        <PriorityBreakdown tasks={completedTasks} />
      </div>

      {/* Heatmap */}
      <CompletionHeatmap tasks={completedTasks} />

      {/* Recent Completions */}
      <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-5">
        <h3 className="text-sm font-medium text-zinc-300 mb-4 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-green-400" />
          Recently Completed
        </h3>
        {completedTasks.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-4">
            No completed tasks in the last 30 days. Get to work! 💪
          </p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {completedTasks.slice(0, 15).map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-zinc-700/20"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span className="text-sm text-zinc-300 line-through opacity-70">
                    {task.title}
                  </span>
                </div>
                <span className="text-xs text-zinc-500 shrink-0">
                  {task.completed_at
                    ? format(new Date(task.completed_at), 'MMM d, h:mm a')
                    : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
