'use server'

import { runIngestion } from '@/lib/ingestion/service'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function triggerIngestion(sourceIds?: string[]) {
    try {
        const sessionClient = await createClient()
        const { data: { user }, error: userError } = await sessionClient.auth.getUser()
        if (userError || !user) {
            return { success: false, error: 'Unauthorized' }
        }

        const result = await runIngestion(sourceIds)
        revalidatePath('/content')
        return { success: true, data: result }
    } catch (error: any) {
        console.error('Ingestion failed:', error)
        return { success: false, error: error.message }
    }
}
