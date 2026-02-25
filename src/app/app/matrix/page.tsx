'use client'

import { Target } from 'lucide-react'

export default function MatrixPage() {
  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <Target className="h-6 w-6 text-green-500" />
          <h1 className="text-2xl font-bold">Eisenhower Matrix</h1>
        </div>
        <p className="text-sm text-muted-foreground ml-9">Coming in Phase 2</p>
      </div>
      <div className="bg-card border border-border rounded-lg p-12 text-center">
        <Target className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">Urgent/Important quadrant view is coming soon.</p>
      </div>
    </div>
  )
}
