'use client'

import { cn, PRIORITY_COLORS, PRIORITY_BORDER } from '@/lib/utils'
import { Check } from 'lucide-react'
import { useState } from 'react'

interface TaskCheckboxProps {
  isCompleted: boolean
  priority: number
  onToggle: () => void
}

export function TaskCheckbox({ isCompleted, priority, onToggle }: TaskCheckboxProps) {
  const [animating, setAnimating] = useState(false)

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (!isCompleted) {
      setAnimating(true)
      setTimeout(() => setAnimating(false), 300)
    }
    onToggle()
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        'h-[18px] w-[18px] rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
        isCompleted
          ? 'bg-primary border-primary'
          : PRIORITY_BORDER[priority] || PRIORITY_BORDER[0],
        !isCompleted && 'hover:bg-accent'
      )}
    >
      {(isCompleted || animating) && (
        <Check className={cn('h-3 w-3 text-white', animating && 'task-complete-check')} strokeWidth={3} />
      )}
    </button>
  )
}
