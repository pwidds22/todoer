'use client'

import { use } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { TaskList } from '@/components/tasks/TaskList'
import { CircleDot } from 'lucide-react'

export default function LabelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const supabase = createClient()

  const { data: label } = useQuery({
    queryKey: ['labels', id],
    queryFn: async () => {
      const { data } = await supabase.from('labels').select('*').eq('id', id).single()
      return data as { id: string; name: string; color: string | null } | null
    },
  })

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks', 'label', id],
    queryFn: async () => {
      const { data: taskLabels } = await supabase
        .from('task_labels')
        .select('task_id')
        .eq('label_id', id)

      if (!taskLabels?.length) return []

      const taskIds = taskLabels.map((tl: { task_id: string }) => tl.task_id)
      const { data } = await supabase
        .from('tasks')
        .select('*, project:projects(*)')
        .in('id', taskIds)
        .eq('is_deleted', false)
        .eq('is_completed', false)
        .order('due_date', { ascending: true })

      return data || []
    },
  })

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <CircleDot className="h-6 w-6" style={{ color: label?.color || undefined }} />
          <h1 className="text-2xl font-bold">{label?.name || 'Label'}</h1>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-accent/30 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <TaskList tasks={tasks || []} emptyMessage="No tasks with this label" />
      )}
    </div>
  )
}
