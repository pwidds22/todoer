'use client'

import { Tag } from 'lucide-react'

export default function HabitsPage() {
  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <Tag className="h-6 w-6 text-emerald-500" />
          <h1 className="text-2xl font-bold">Habits</h1>
        </div>
        <p className="text-sm text-muted-foreground ml-9">Coming in Phase 3</p>
      </div>
      <div className="bg-card border border-border rounded-lg p-12 text-center">
        <Tag className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">Habit tracking with streaks and heatmaps is coming soon.</p>
      </div>
    </div>
  )
}
