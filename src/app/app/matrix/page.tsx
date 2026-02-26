'use client'

import { useMemo } from 'react'
import { Target, AlertTriangle, Clock, Inbox, Coffee, Loader2 } from 'lucide-react'
import { isToday } from 'date-fns'
import { useTasks } from '@/hooks/useTasks'
import { isOverdue } from '@/lib/utils'
import { TaskItem } from '@/components/tasks/TaskItem'
import type { Task, Project } from '@/types/database'

type TaskWithProject = Task & { project?: Project | null }

interface QuadrantConfig {
  key: string
  title: string
  subtitle: string
  icon: React.ReactNode
  bgClass: string
  borderClass: string
  headerBgClass: string
  badgeClass: string
  textClass: string
}

const QUADRANTS: QuadrantConfig[] = [
  {
    key: 'q1',
    title: 'Do First',
    subtitle: 'Urgent & Important',
    icon: <AlertTriangle className="h-4 w-4" />,
    bgClass: 'bg-red-500/5',
    borderClass: 'border-red-500/30',
    headerBgClass: 'bg-red-500/10',
    badgeClass: 'bg-red-500/20 text-red-400',
    textClass: 'text-red-400',
  },
  {
    key: 'q2',
    title: 'Schedule',
    subtitle: 'Not Urgent & Important',
    icon: <Clock className="h-4 w-4" />,
    bgClass: 'bg-blue-500/5',
    borderClass: 'border-blue-500/30',
    headerBgClass: 'bg-blue-500/10',
    badgeClass: 'bg-blue-500/20 text-blue-400',
    textClass: 'text-blue-400',
  },
  {
    key: 'q3',
    title: 'Delegate',
    subtitle: 'Urgent & Not Important',
    icon: <Inbox className="h-4 w-4" />,
    bgClass: 'bg-amber-500/5',
    borderClass: 'border-amber-500/30',
    headerBgClass: 'bg-amber-500/10',
    badgeClass: 'bg-amber-500/20 text-amber-400',
    textClass: 'text-amber-400',
  },
  {
    key: 'q4',
    title: 'Eliminate',
    subtitle: 'Not Urgent & Not Important',
    icon: <Coffee className="h-4 w-4" />,
    bgClass: 'bg-green-500/5',
    borderClass: 'border-green-500/30',
    headerBgClass: 'bg-green-500/10',
    badgeClass: 'bg-green-500/20 text-green-400',
    textClass: 'text-green-400',
  },
]

function isUrgent(task: Task): boolean {
  if (!task.due_date) return false
  const taskDate = new Date(task.due_date + 'T00:00:00')
  return isToday(taskDate) || isOverdue(task.due_date, task.due_time)
}

function classifyTask(task: Task): string {
  const priority = task.priority ?? 0
  const isImportant = priority >= 1 && priority <= 2
  const urgent = isUrgent(task)

  if (isImportant && urgent) return 'q1'
  if (isImportant && !urgent) return 'q2'
  if (!isImportant && urgent) return 'q3'
  return 'q4'
}

function QuadrantCard({
  config,
  tasks,
}: {
  config: QuadrantConfig
  tasks: TaskWithProject[]
}) {
  return (
    <div
      className={`rounded-lg border ${config.borderClass} ${config.bgClass} flex flex-col overflow-hidden`}
    >
      <div className={`${config.headerBgClass} px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span className={config.textClass}>{config.icon}</span>
          <div>
            <h2 className={`text-sm font-semibold ${config.textClass}`}>
              {config.title}
            </h2>
            <p className="text-xs text-zinc-500">{config.subtitle}</p>
          </div>
        </div>
        {tasks.length > 0 && (
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.badgeClass}`}
          >
            {tasks.length}
          </span>
        )}
      </div>

      <div className="flex-1 p-2 min-h-[120px]">
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center h-full min-h-[100px]">
            <p className="text-xs text-zinc-600">No tasks</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {tasks.map((task) => (
              <TaskItem key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function MatrixPage() {
  const { data: tasks, isLoading } = useTasks({ isCompleted: false })

  const quadrants = useMemo(() => {
    if (!tasks) return { q1: [], q2: [], q3: [], q4: [] }

    const grouped: Record<string, TaskWithProject[]> = {
      q1: [],
      q2: [],
      q3: [],
      q4: [],
    }

    for (const task of tasks) {
      const q = classifyTask(task)
      grouped[q].push(task)
    }

    return grouped
  }, [tasks])

  const totalClassified = quadrants.q1.length + quadrants.q2.length + quadrants.q3.length + quadrants.q4.length

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Target className="h-6 w-6 text-green-500" />
          <h1 className="text-2xl font-bold">Eisenhower Matrix</h1>
        </div>
        <p className="text-sm text-zinc-500 ml-9">
          Prioritize tasks by urgency and importance
          {!isLoading && totalClassified > 0 && (
            <span className="text-zinc-600"> &middot; {totalClassified} tasks</span>
          )}
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-48 bg-zinc-800/50 border border-zinc-700/50 rounded-lg animate-pulse flex items-center justify-center"
            >
              <Loader2 className="h-5 w-5 text-zinc-600 animate-spin" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {QUADRANTS.map((config) => (
            <QuadrantCard
              key={config.key}
              config={config}
              tasks={quadrants[config.key] || []}
            />
          ))}
        </div>
      )}

      {!isLoading && totalClassified === 0 && (
        <div className="mt-8 text-center">
          <Target className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">
            No active tasks to classify. Add tasks with priorities and due dates to see them here.
          </p>
        </div>
      )}
    </div>
  )
}
