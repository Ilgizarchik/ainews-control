import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { Database } from '@/types/database.types'

export const createClient = async () => {
  const cookieStore = await cookies()

  const getCookie = (name: string) => cookieStore.get(name)?.value
  const setCookie = (name: string, value: string, options: CookieOptions = {}) => {
    try {
      cookieStore.set(name, value, options)
    } catch { }
  }
  const removeCookie = (name: string, options: CookieOptions = {}) => {
    try {
      cookieStore.set(name, '', { ...options, maxAge: 0 })
    } catch { }
  }

  return createServerClient<Database, 'public', Database['public']>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return getCookie(name)
        },
        set(name: string, value: string, options: CookieOptions) {
          setCookie(name, value, options)
        },
        remove(name: string, options: CookieOptions) {
          removeCookie(name, options)
        },
      },
    }
  ) as unknown as SupabaseClient<Database, 'public', 'public', any>
}
