'use client'

import { QueryClient, QueryClientProvider, MutationCache, QueryCache } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'

export function Providers({ children }: { children: React.ReactNode }) {
  return <AuthProvider><AccountQueries>{children}</AccountQueries></AuthProvider>
}

function AccountQueries({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div role="status" className="p-6 text-sm text-muted-foreground">Opening Todoer…</div>
  return <QueryScope key={user?.id ?? 'signed-out'}>{children}</QueryScope>
}

function QueryScope({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        mutationCache: new MutationCache({ onError: (error) => toast.error(error.message || 'Could not save. Please try again.') }),
        queryCache: new QueryCache({ onError: () => toast.error('Could not refresh your data. Check your connection and try again.', { id: 'data-error' }) }),
        defaultOptions: {
          mutations: { retry: false, networkMode: 'always' },
          queries: {
            staleTime: 1000 * 60,
            refetchOnWindowFocus: true,
          },
        },
      })
  )

  useEffect(() => () => { void queryClient.cancelQueries(); queryClient.clear() }, [queryClient])

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
