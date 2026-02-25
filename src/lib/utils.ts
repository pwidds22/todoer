import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const PRIORITY_COLORS: Record<number, string> = {
  0: 'text-muted-foreground',
  1: 'text-blue-500',
  2: 'text-yellow-500',
  3: 'text-orange-500',
  4: 'text-red-500',
}

export const PRIORITY_BG: Record<number, string> = {
  0: 'bg-muted-foreground/20',
  1: 'bg-blue-500/20',
  2: 'bg-yellow-500/20',
  3: 'bg-orange-500/20',
  4: 'bg-red-500/20',
}

export const PRIORITY_BORDER: Record<number, string> = {
  0: 'border-muted-foreground/30',
  1: 'border-blue-500/50',
  2: 'border-yellow-500/50',
  3: 'border-orange-500/50',
  4: 'border-red-500/50',
}

export const PRIORITY_LABELS: Record<number, string> = {
  0: 'None',
  1: 'Low',
  2: 'Medium',
  3: 'High',
  4: 'Urgent',
}

export function formatDueDate(date: string | null, time: string | null): string {
  if (!date) return ''
  const d = new Date(date + 'T00:00:00')
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const taskDate = new Date(d.getFullYear(), d.getMonth(), d.getDate())

  let dateStr = ''
  if (taskDate.getTime() === today.getTime()) {
    dateStr = 'Today'
  } else if (taskDate.getTime() === tomorrow.getTime()) {
    dateStr = 'Tomorrow'
  } else if (taskDate < today) {
    const daysAgo = Math.floor((today.getTime() - taskDate.getTime()) / 86400000)
    dateStr = `${daysAgo}d overdue`
  } else {
    dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (time) {
    const [h, m] = time.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour12 = h % 12 || 12
    dateStr += ` ${hour12}:${m.toString().padStart(2, '0')} ${ampm}`
  }

  return dateStr
}

export function isOverdue(date: string | null, time: string | null): boolean {
  if (!date) return false
  const now = new Date()
  if (time) {
    const dt = new Date(`${date}T${time}`)
    return dt < now
  }
  const d = new Date(date + 'T23:59:59')
  return d < now
}
