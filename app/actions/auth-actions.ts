'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const supabase = await createClient()

    console.log(`[AUTH] Attempting login for ${email}`)
    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        console.log(`[AUTH] Login failed for ${email}: ${error.message}`)
        return { error: error.message }
    }

    console.log(`[AUTH] Login success for ${email}, redirecting to /publications...`)
    // revalidatePath('/', 'layout')
    redirect('/publications')
}

export async function signOut() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    revalidatePath('/', 'layout')
    redirect('/login')
}
