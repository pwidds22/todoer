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

export interface SharedProject {
  id: string
  project_id: string
  owner_id: string
  shared_with_id: string
  created_at: string | null
}

// ===== CONNECTIONS (shared_accounts) =====

/**
 * Get all connections where the current user is the owner (people I invited)
 */
export function useMyConnections() {
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
 * Get accepted connections where I am the shared_with user
 */
export function useConnectedWithMe() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['shared_accounts', 'connected_with_me'],
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
 * Get all accepted connections (both directions) for sharing UI
 */
export function useAcceptedConnections() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['shared_accounts', 'accepted'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shared_accounts')
        .select('*')
        .eq('status', 'accepted')
        .or(`owner_id.eq.${user!.id},shared_with_id.eq.${user!.id}`)

      if (error) throw error
      return (data as SharedAccount[]).map(sa => ({
        ...sa,
        // The "other" user's id for sharing purposes
        other_user_id: sa.owner_id === user!.id ? sa.shared_with_id! : sa.owner_id,
        other_user_email: sa.shared_with_email,
        is_owner: sa.owner_id === user!.id,
      }))
    },
    enabled: !!user,
  })
}

/**
 * Invite someone to connect with your account
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
 * Remove a connection (owner only)
 */
export function useRemoveConnection() {
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
      // Also refresh shared projects since removing a connection may affect access
      queryClient.invalidateQueries({ queryKey: ['shared_projects'] })
    },
  })
}

// ===== PER-PROJECT SHARING (shared_projects) =====

/**
 * Get all projects shared BY the current user
 */
export function useMySharedProjects() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['shared_projects', 'mine'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shared_projects')
        .select('*')
        .eq('owner_id', user!.id)

      if (error) throw error
      return data as SharedProject[]
    },
    enabled: !!user,
  })
}

/**
 * Get sharing info for a specific project
 */
export function useProjectShares(projectId: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['shared_projects', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shared_projects')
        .select('*')
        .eq('project_id', projectId)

      if (error) throw error
      return data as SharedProject[]
    },
    enabled: !!user && !!projectId,
  })
}

/**
 * Share a project with a connected user
 */
export function useShareProject() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async ({ projectId, sharedWithId }: { projectId: string; sharedWithId: string }) => {
      const { data, error } = await supabase
        .from('shared_projects')
        .insert({
          project_id: projectId,
          owner_id: user!.id,
          shared_with_id: sharedWithId,
        })
        .select()
        .single()

      if (error) throw error
      return data as SharedProject
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['shared_projects'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

/**
 * Unshare a project
 */
export function useUnshareProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (shareId: string) => {
      const { error } = await supabase
        .from('shared_projects')
        .delete()
        .eq('id', shareId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared_projects'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}
