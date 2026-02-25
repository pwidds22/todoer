'use client'

import { Timer } from 'lucide-react'

export default function FocusPage() {
  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <Timer className="h-6 w-6 text-red-500" />
          <h1 className="text-2xl font-bold">Focus</h1>
        </div>
        <p className="text-sm text-muted-foreground ml-9">Coming in Phase 3</p>
      </div>
      <div className="bg-card border border-border rounded-lg p-12 text-center">
        <Timer className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">Pomodoro timer with task integration is coming soon.</p>
      </div>
    </div>
  )
}
