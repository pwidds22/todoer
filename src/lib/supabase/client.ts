import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

let client: ReturnType<typeof createSupabaseClient<Database>> | undefined

export function createClient() {
  // One auth session and subscription manager per browser, not one per render.
  client ??= createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  return client
}
