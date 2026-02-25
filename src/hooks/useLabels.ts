'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Label, LabelInsert } from '@/types/database'

const supabase = createClient()

export function useLabels() {
  return useQuery({
    queryKey: ['labels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('labels')
        .select('*')
        .order('position', { ascending: true })

      if (error) throw error
      return (data || []) as Label[]
    },
  })
}

export function useCreateLabel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (label: LabelInsert) => {
      const { data, error } = await supabase
        .from('labels')
        .insert(label)
        .select()
        .single()

      if (error) throw error
      return data as Label
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels'] })
    },
  })
}

export function useUpdateLabel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; color?: string }) => {
      const { data, error } = await supabase
        .from('labels')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as Label
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels'] })
    },
  })
}

export function useDeleteLabel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('labels').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels'] })
    },
  })
}
