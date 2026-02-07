import { createAdminClient } from './supabase/admin'
import { runIngestion } from '@/lib/ingestion/service'
import { addMinutes, isAfter } from 'date-fns'

export async function checkAndRunScheduleCore() {
    const supabase = createAdminClient()

    // 1. Get Schedule Config
    const { data: settings } = await supabase
        .from('project_settings')
        .select('value')
        .eq('project_key', 'ainews')
        .eq('key', 'ingestion_schedule')
        .single()

    if (!settings || !(settings as any).value) {
        return { triggered: false, reason: 'no-config' }
    }

    let schedule
    try {
        schedule = JSON.parse((settings as any).value)
    } catch (e) {
        return { triggered: false, reason: 'invalid-config' }
    }

    if (!schedule.mode || schedule.mode === 'manual') {
        return { triggered: false, reason: 'manual-mode' }
    }

    // 2. Get Last Run Time from global settings (more reliable than sources)
    const { data: lastRunRecord } = await supabase
        .from('project_settings')
        .select('value')
        .eq('project_key', 'ainews')
        .eq('key', 'last_ingestion_run')
        .single()

    const lastRunTime = lastRunRecord?.value ? new Date(lastRunRecord.value).getTime() : 0
    const lastRunDate = lastRunTime > 0 ? new Date(lastRunTime) : null
    const now = new Date()

    // 3. Check Schedule Mode
    let shouldRun = false
    let reason = ''

    if (schedule.mode === 'interval') {
        const intervalMinutes = parseInt(schedule.value || '60', 10)
        const isFirstRun = !lastRunDate
        const nextRun = lastRunDate ? addMinutes(lastRunDate, intervalMinutes) : now

        if (isFirstRun || isAfter(now, nextRun)) {
            shouldRun = true
            reason = isFirstRun ? 'First Run' : `Interval Passed (${intervalMinutes}m)`
        }
    } else if (schedule.mode === 'daily') {
        const [targetHour, targetMinute] = (schedule.value || '00:00').split(':').map(Number)
        const targetTimeToday = new Date(now)
        targetTimeToday.setHours(targetHour, targetMinute, 0, 0)

        const wasRunTodayAfterTarget = lastRunDate &&
            lastRunDate.getDate() === now.getDate() &&
            lastRunDate.getMonth() === now.getMonth() &&
            lastRunDate.getFullYear() === now.getFullYear() &&
            isAfter(lastRunDate, targetTimeToday)

        if (isAfter(now, targetTimeToday) && !wasRunTodayAfterTarget) {
            shouldRun = true
            reason = `Daily Target (${schedule.value})`
        }
    }

    if (shouldRun) {

        // НЕМЕДЛЕННО обновляем глобальную метку, чтобы другие циклы (через минуту) 
        // увидели, что мы уже в процессе или только что запустились.
        // Используем upsert или update в зависимости от наличия.
        await supabase
            .from('project_settings')
            .upsert({
                project_key: 'ainews',
                key: 'last_ingestion_run',
                value: now.toISOString(),
                is_active: true
            } as any, { onConflict: 'project_key,key' })

        // Запускаем инжест. runIngestion сам обновит last_run_at у каждого источника в конце.
        await runIngestion(undefined, supabase)
        return { triggered: true, reason }
    }

    return { triggered: false, reason: 'not-time-yet' }
}

// End of checkAndRunScheduleCore
export async function checkAndRunPublishSchedule() {
    const supabase = createAdminClient()
    const now = new Date().toISOString()



    // RE-WRITING THE WHOLE FUNCTION logic to be safe and clean

    // 1. Find jobs due
    const { data: jobsWithPlatform, error } = await supabase
        .from('publish_jobs')
        .select('id, platform')
        .eq('status', 'queued')
        .lte('publish_at', now)

    if (error) {
        console.error('[Scheduler] Error fetching due publish jobs:', error)
        return { success: false, error: error.message }
    }

    if (!jobsWithPlatform || jobsWithPlatform.length === 0) {
        return { success: true, processed: 0 }
    }

    const { processPublishJob } = await import('@/lib/publishers/service')

    // 2. Prioritize 'site' publication
    const siteJobIds = jobsWithPlatform.filter((j: any) => j.platform === 'site' || j.platform === 'tilda').map((j: any) => j.id)
    const otherJobIds = jobsWithPlatform.filter((j: any) => j.platform !== 'site' && j.platform !== 'tilda').map((j: any) => j.id)

    const results: any[] = []

    // 2.1 Run Site jobs SEQUENTIALLY first to ensure links are generated
    if (siteJobIds.length > 0) {
        console.log(`[Scheduler] Processing ${siteJobIds.length} site jobs first...`)
        for (const id of siteJobIds) {
            const res = await processPublishJob(id)
            results.push(res)
        }
    }

    // 2.2 Run others in parallel
    if (otherJobIds.length > 0) {
        console.log(`[Scheduler] Processing ${otherJobIds.length} other jobs...`)
        const otherResults = await Promise.all(
            otherJobIds.map((id: string) => processPublishJob(id))
        )
        results.push(...otherResults)
    }

    return {
        success: true,
        processed: jobsWithPlatform.length,
        results
    }
}
