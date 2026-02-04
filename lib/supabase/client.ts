import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

export const createClient = () =>
  createBrowserClient<Database, 'public', Database['public']>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ) as unknown as SupabaseClient<Database, 'public', 'public', any>
