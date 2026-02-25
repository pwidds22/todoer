'use client'

import { useState } from 'react'
import { useCreateLabel } from '@/hooks/useLabels'
import { useAuth } from '@/hooks/useAuth'
import { X, Check } from 'lucide-react'

const COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
]

export function LabelForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#3b82f6')
  const { user } = useAuth()
  const createLabel = useCreateLabel()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !user) return

    await createLabel.mutateAsync({
      name: name.trim(),
      color,
      user_id: user.id,
    })
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="mx-2 p-2 bg-card border border-border rounded-md space-y-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Label name"
        className="w-full px-2 py-1 text-sm bg-transparent border border-border rounded focus:outline-none focus:border-primary"
      />
      <div className="flex flex-wrap gap-1">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            className="w-5 h-5 rounded-full border-2 transition-transform"
            style={{
              backgroundColor: c,
              borderColor: c === color ? 'white' : 'transparent',
              transform: c === color ? 'scale(1.2)' : 'scale(1)',
            }}
          />
        ))}
      </div>
      <div className="flex gap-1 justify-end">
        <button type="button" onClick={onClose} className="p-1 hover:bg-accent rounded">
          <X className="h-4 w-4" />
        </button>
        <button type="submit" disabled={!name.trim()} className="p-1 hover:bg-accent rounded text-primary disabled:opacity-50">
          <Check className="h-4 w-4" />
        </button>
      </div>
    </form>
  )
}
