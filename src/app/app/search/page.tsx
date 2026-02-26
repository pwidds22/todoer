'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TaskItem } from '@/components/tasks/TaskItem'
import { Search, X, Loader2 } from 'lucide-react'
import type { Task, Project } from '@/types/database'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<(Task & { project: Project | null })[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 2) {
        searchTasks(query.trim())
      } else {
        setResults([])
        setSearched(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  async function searchTasks(searchQuery: string) {
    setLoading(true)
    setSearched(true)

    const { data, error } = await supabase
      .from('tasks')
      .select('*, project:projects(*)')
      .eq('is_deleted', false)
      .ilike('title', `%${searchQuery}%`)
      .order('is_completed', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(50)

    if (!error && data) {
      setResults(data as (Task & { project: Project | null })[])
    }
    setLoading(false)
  }

  const activeTasks = results.filter(t => !t.is_completed)
  const completedTasks = results.filter(t => t.is_completed)

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Search className="h-6 w-6" />
          Search
        </h1>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks..."
            className="w-full bg-accent rounded-lg pl-10 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setResults([]); setSearched(false); inputRef.current?.focus() }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-accent rounded"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-2">
          Type at least 2 characters to search. Press <kbd className="px-1.5 py-0.5 bg-accent rounded text-[10px]">/</kbd> from anywhere to jump here.
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Searching...
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-sm">No tasks found matching &quot;{query}&quot;</p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-6">
          {activeTasks.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider px-3 py-1 text-muted-foreground">
                Active tasks <span className="font-normal">({activeTasks.length})</span>
              </h3>
              <div>
                {activeTasks.map((task) => (
                  <TaskItem key={task.id} task={task} />
                ))}
              </div>
            </div>
          )}

          {completedTasks.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider px-3 py-1 text-muted-foreground">
                Completed <span className="font-normal">({completedTasks.length})</span>
              </h3>
              <div>
                {completedTasks.map((task) => (
                  <TaskItem key={task.id} task={task} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
