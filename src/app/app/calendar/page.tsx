'use client'

import { CalendarDays } from 'lucide-react'

export default function CalendarPage() {
  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-6 w-6 text-blue-500" />
          <h1 className="text-2xl font-bold">Calendar</h1>
        </div>
        <p className="text-sm text-muted-foreground ml-9">Coming in Phase 2</p>
      </div>
      <div className="bg-card border border-border rounded-lg p-12 text-center">
        <CalendarDays className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">Calendar view with drag-to-reschedule is coming soon.</p>
      </div>
    </div>
  )
}
