
import { NextRequest, NextResponse } from 'next/server'
import { runIngestion } from '@/lib/ingestion/service'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
    const authHeader = req.headers.get('Authorization')
    if (authHeader !== `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    try {
        console.log('[Cron] Checking ingestion schedule...')
        const { checkAndRunScheduleCore } = await import('@/lib/scheduler')
        const results = await checkAndRunScheduleCore()

        return NextResponse.json({ success: true, results })
    } catch (e: any) {
        console.error('[Cron] Ingestion check failed:', e)
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
