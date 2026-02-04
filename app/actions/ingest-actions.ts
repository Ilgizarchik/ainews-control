'use server'

import { runIngestion } from '@/lib/ingestion/service'
import { revalidatePath } from 'next/cache'

export async function triggerIngestion(sourceIds?: string[]) {
    try {
        const result = await runIngestion(sourceIds)
        revalidatePath('/content')
        return { success: true, data: result }
    } catch (error: any) {
        console.error('Ingestion failed:', error)
        return { success: false, error: error.message }
    }
}
