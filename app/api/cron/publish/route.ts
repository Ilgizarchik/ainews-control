
import { NextRequest, NextResponse } from 'next/server'


export async function POST(req: NextRequest) {
    const authHeader = req.headers.get('Authorization')
    if (authHeader !== `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    try {
        let job_ids: string[] | null = null;

        try {
            const body = await req.json();
            if (body && Array.isArray(body.job_ids)) {
                job_ids = body.job_ids;
            }
        } catch (e) {
            // Тело пустое или не JSON - ок, работаем как планировщик
        }

        if (job_ids) {
            console.log(`[Cron] Force triggering publication for ${job_ids.length} jobs:`, job_ids)
            const { processPublishJob } = await import('@/lib/publishers/service')
            const results = await Promise.all(
                job_ids.map(id => processPublishJob(id))
            )
            return NextResponse.json({ success: true, processed: job_ids.length, results })
        } else {
            console.log('[Cron] Checking publication schedule...')
            const { checkAndRunPublishSchedule } = await import('@/lib/scheduler')
            const results = await checkAndRunPublishSchedule()
            return NextResponse.json({ ...results })
        }
    } catch (e: any) {
        console.error('[Cron] Publication failed:', e)
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
