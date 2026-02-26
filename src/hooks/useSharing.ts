'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth'

const supabase = createClient()

export interface SharedAccount {
  id: string
  owner_id: string
  shared_with_id: string | null
  shared_with_email: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
  accepted_at: string | null
}

/**
 * Get all sharing relationships where the current user is the owner (people I invited)
 */
export function useMyShares() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['shared_accounts', 'mine'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shared_accounts')
        .select('*')
        .eq('owner_id', user!.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as SharedAccount[]
    },
    enabled: !!user,
  })
}

/**
 * Get pending invitations where the current user was invited (by email match)
 */
export function usePendingInvitations() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['shared_accounts', 'invitations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shared_accounts')
        .select('*')
        .eq('shared_with_email', user!.email!)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as SharedAccount[]
    },
    enabled: !!user?.email,
  })
}

/**
 * Get accepted shares where I am the shared_with user (people who shared with me)
 */
export function useSharedWithMe() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['shared_accounts', 'shared_with_me'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shared_accounts')
        .select('*')
        .eq('shared_with_id', user!.id)
        .eq('status', 'accepted')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as SharedAccount[]
    },
    enabled: !!user,
  })
}

/**
 * Invite someone to share your account
 */
export function useInviteUser() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase
        .from('shared_accounts')
        .insert({
          owner_id: user!.id,
          shared_with_email: email.toLowerCase().trim(),
        })
        .select()
        .single()

      if (error) throw error
      return data as SharedAccount
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared_accounts'] })
    },
  })
}

/**
 * Accept a pending invitation
 */
export function useAcceptInvitation() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (shareId: string) => {
      const { error } = await supabase
        .from('shared_accounts')
        .update({
          shared_with_id: user!.id,
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', shareId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared_accounts'] })
      // Refresh all data since we now have access to shared content
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['labels'] })
      queryClient.invalidateQueries({ queryKey: ['habits'] })
    },
  })
}

/**
 * Decline a pending invitation
 */
export function useDeclineInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (shareId: string) => {
      const { error } = await supabase
        .from('shared_accounts')
        .update({ status: 'declined' })
        .eq('id', shareId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared_accounts'] })
    },
  })
}

/**
 * Remove a sharing relationship (owner only)
 */
export function useRemoveShare() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (shareId: string) => {
      const { error } = await supabase
        .from('shared_accounts')
        .delete()
        .eq('id', shareId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared_accounts'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['labels'] })
      queryClient.invalidateQueries({ queryKey: ['habits'] })
    },
  })
}
