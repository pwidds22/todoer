'use client'

import { useState, useMemo, useCallback } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Circle, CheckCircle2 } from 'lucide-react'
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
} from 'date-fns'
import { useTasks, useCompleteTask } from '@/hooks/useTasks'
import { cn, PRIORITY_COLORS } from '@/lib/utils'
import type { Task, Project } from '@/types/database'

// Priority dot fill colors (solid backgrounds for the small dots)
const PRIORITY_DOT_BG: Record<number, string> = {
  0: 'bg-zinc-500',
  1: 'bg-blue-500',
  2: 'bg-yellow-500',
  3: 'bg-orange-500',
  4: 'bg-red-500',
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MAX_VISIBLE_TASKS = 3

type TaskWithProject = Task & { project?: Project | null }

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  // Compute the date range for the visible calendar grid (includes padding days)
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

  // Fetch tasks for the visible range
  const { data: tasks, isLoading } = useTasks({
    dueDateRange: {
      from: format(calendarStart, 'yyyy-MM-dd'),
      to: format(calendarEnd, 'yyyy-MM-dd'),
    },
  })

  // Build a map of date string -> tasks for fast lookup
  const tasksByDate = useMemo(() => {
    const map: Record<string, TaskWithProject[]> = {}
    if (!tasks) return map
    for (const task of tasks) {
      if (!task.due_date) continue
      const key = task.due_date
      if (!map[key]) map[key] = []
      map[key].push(task)
    }
    return map
  }, [tasks])

  // All calendar days in the grid
  const calendarDays = useMemo(
    () => eachDayOfInterval({ start: calendarStart, end: calendarEnd }),
    [calendarStart.getTime(), calendarEnd.getTime()]
  )

  // Navigation
  const goToPrevMonth = useCallback(() => setCurrentMonth(prev => subMonths(prev, 1)), [])
  const goToNextMonth = useCallback(() => setCurrentMonth(prev => addMonths(prev, 1)), [])
  const goToToday = useCallback(() => {
    setCurrentMonth(new Date())
    setSelectedDate(new Date())
  }, [])

  // Get tasks for the selected date
  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null
  const selectedDayTasks = selectedDateStr ? (tasksByDate[selectedDateStr] || []) : []

  const totalTasksWithDates = tasks?.filter(t => t.due_date).length || 0

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <CalendarDays className="h-6 w-6 text-blue-500" />
          <h1 className="text-2xl font-bold">Calendar</h1>
        </div>
        <p className="text-sm text-muted-foreground ml-9">
          {totalTasksWithDates} task{totalTasksWithDates !== 1 ? 's' : ''} scheduled
        </p>
      </div>

      {/* Calendar card */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {/* Month navigation header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrevMonth}
              className="p-1.5 rounded-md hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={goToNextMonth}
              className="p-1.5 rounded-md hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Next month"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-semibold ml-2">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
          </div>
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-sm font-medium rounded-md border border-border hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground"
          >
            Today
          </button>
        </div>

        {/* Day of week headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {DAY_NAMES.map(day => (
            <div
              key={day}
              className="px-1 sm:px-2 py-2 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider"
            >
              <span className="hidden sm:inline">{day}</span>
              <span className="sm:hidden">{day.charAt(0)}</span>
            </div>
          ))}
        </div>

        {/* Loading state */}
        {isLoading ? (
          <div className="grid grid-cols-7">
            {Array.from({ length: 35 }).map((_, i) => (
              <div
                key={i}
                className="min-h-[80px] sm:min-h-[100px] border-b border-r border-border p-1 sm:p-2"
              >
                <div className="h-4 w-6 bg-accent/30 rounded animate-pulse mb-1" />
              </div>
            ))}
          </div>
        ) : (
          /* Calendar grid */
          <div className="grid grid-cols-7">
            {calendarDays.map((day, idx) => {
              const dateStr = format(day, 'yyyy-MM-dd')
              const dayTasks = tasksByDate[dateStr] || []
              const inCurrentMonth = isSameMonth(day, currentMonth)
              const today = isToday(day)
              const isSelected = selectedDate ? isSameDay(day, selectedDate) : false
              const overflowCount = Math.max(0, dayTasks.length - MAX_VISIBLE_TASKS)
              const visibleTasks = dayTasks.slice(0, MAX_VISIBLE_TASKS)

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    'min-h-[72px] sm:min-h-[100px] border-b border-r border-border p-1 sm:p-2 text-left transition-colors cursor-pointer',
                    'hover:bg-accent/30',
                    !inCurrentMonth && 'bg-accent/5',
                    isSelected && 'bg-accent/40 ring-1 ring-inset ring-blue-500/50'
                  )}
                >
                  {/* Day number */}
                  <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                    <span
                      className={cn(
                        'inline-flex items-center justify-center text-xs sm:text-sm font-medium',
                        'h-6 w-6 sm:h-7 sm:w-7 rounded-full',
                        today && 'bg-blue-500 text-white',
                        !today && inCurrentMonth && 'text-foreground',
                        !today && !inCurrentMonth && 'text-muted-foreground/50'
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                    {dayTasks.length > 0 && (
                      <span className="text-[10px] text-muted-foreground hidden sm:inline">
                        {dayTasks.length}
                      </span>
                    )}
                  </div>

                  {/* Task indicators */}
                  <div className="space-y-0.5">
                    {/* Desktop: show short task titles */}
                    {visibleTasks.map(task => (
                      <div
                        key={task.id}
                        className="hidden sm:flex items-center gap-1 group/task"
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full shrink-0',
                            PRIORITY_DOT_BG[task.priority ?? 0]
                          )}
                        />
                        <span
                          className={cn(
                            'text-[11px] leading-tight truncate',
                            task.is_completed
                              ? 'line-through text-muted-foreground/60'
                              : inCurrentMonth
                                ? 'text-foreground/80'
                                : 'text-muted-foreground/50'
                          )}
                        >
                          {task.title}
                        </span>
                      </div>
                    ))}

                    {/* Desktop: overflow indicator */}
                    {overflowCount > 0 && (
                      <span className="hidden sm:block text-[10px] text-muted-foreground pl-3">
                        +{overflowCount} more
                      </span>
                    )}

                    {/* Mobile: colored dots only */}
                    {dayTasks.length > 0 && (
                      <div className="flex sm:hidden gap-0.5 flex-wrap mt-0.5">
                        {dayTasks.slice(0, 5).map(task => (
                          <span
                            key={task.id}
                            className={cn(
                              'h-1.5 w-1.5 rounded-full',
                              PRIORITY_DOT_BG[task.priority ?? 0]
                            )}
                          />
                        ))}
                        {dayTasks.length > 5 && (
                          <span className="text-[9px] text-muted-foreground">+{dayTasks.length - 5}</span>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Selected day detail panel */}
      {selectedDate && (
        <SelectedDayPanel
          date={selectedDate}
          tasks={selectedDayTasks}
          onClearSelection={() => setSelectedDate(null)}
        />
      )}

      {/* Empty state when no tasks have due dates at all */}
      {!isLoading && totalTasksWithDates === 0 && !selectedDate && (
        <div className="mt-6 text-center py-12 bg-card border border-border rounded-lg">
          <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">
            No tasks with due dates yet. Add due dates to your tasks to see them here.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Selected Day Panel ──────────────────────────────────────────

interface SelectedDayPanelProps {
  date: Date
  tasks: TaskWithProject[]
  onClearSelection: () => void
}

function SelectedDayPanel({ date, tasks, onClearSelection }: SelectedDayPanelProps) {
  const completeTask = useCompleteTask()
  const today = isToday(date)

  const incompleteTasks = tasks.filter(t => !t.is_completed)
  const completedTasks = tasks.filter(t => t.is_completed)

  return (
    <div className="mt-4 bg-card border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-border">
        <div>
          <h3 className="font-semibold text-sm">
            {format(date, 'EEEE, MMMM d, yyyy')}
          </h3>
          <p className="text-xs text-muted-foreground">
            {today ? 'Today' : ''}{' '}
            {tasks.length === 0
              ? 'No tasks'
              : `${incompleteTasks.length} task${incompleteTasks.length !== 1 ? 's' : ''}`
            }
            {completedTasks.length > 0 && ` \u00b7 ${completedTasks.length} completed`}
          </p>
        </div>
        <button
          onClick={onClearSelection}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-accent/50"
        >
          Close
        </button>
      </div>

      {tasks.length === 0 ? (
        <div className="px-4 sm:px-5 py-8 text-center">
          <p className="text-sm text-muted-foreground">No tasks scheduled for this day.</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {/* Incomplete tasks */}
          {incompleteTasks.map(task => (
            <DayPanelTaskItem
              key={task.id}
              task={task}
              onToggle={() => completeTask.mutate({ id: task.id, isCompleted: true })}
            />
          ))}

          {/* Completed tasks */}
          {completedTasks.length > 0 && (
            <div>
              <div className="px-4 sm:px-5 py-2 bg-accent/20">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Completed ({completedTasks.length})
                </span>
              </div>
              {completedTasks.map(task => (
                <DayPanelTaskItem
                  key={task.id}
                  task={task}
                  onToggle={() => completeTask.mutate({ id: task.id, isCompleted: false })}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Day Panel Task Item ─────────────────────────────────────────

interface DayPanelTaskItemProps {
  task: TaskWithProject
  onToggle: () => void
}

function DayPanelTaskItem({ task, onToggle }: DayPanelTaskItemProps) {
  const priorityColor = PRIORITY_COLORS[task.priority ?? 0]
  const dotBg = PRIORITY_DOT_BG[task.priority ?? 0]

  return (
    <div className="flex items-center gap-3 px-4 sm:px-5 py-2.5 hover:bg-accent/30 transition-colors group">
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
        className={cn(
          'shrink-0 transition-colors',
          priorityColor
        )}
        aria-label={task.is_completed ? 'Mark as incomplete' : 'Mark as complete'}
      >
        {task.is_completed ? (
          <CheckCircle2 className="h-[18px] w-[18px]" />
        ) : (
          <Circle className="h-[18px] w-[18px]" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm',
            task.is_completed && 'line-through text-muted-foreground'
          )}
        >
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {task.due_time && (
            <span className="text-xs text-muted-foreground">
              {formatTime(task.due_time)}
            </span>
          )}
          {task.project && (
            <span className="text-xs text-muted-foreground">
              <span
                className="inline-block h-2 w-2 rounded-sm mr-1"
                style={{ backgroundColor: (task.project as any).color || '#6b7280' }}
              />
              {(task.project as any).name}
            </span>
          )}
        </div>
      </div>

      {/* Priority indicator */}
      <span className={cn('h-2 w-2 rounded-full shrink-0', dotBg)} />
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`
}
