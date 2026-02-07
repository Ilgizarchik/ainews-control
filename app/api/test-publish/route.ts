import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { TelegramPublisher } from '@/lib/publishers/telegram'
import { TildaPublisher } from '@/lib/publishers/tilda'

// Force dynamic because we use DB
export const dynamic = 'force-dynamic'

export async function GET(_req: Request) {
    const supabase = await createClient()

    // 1. Get Config (Simulating getPublisherConfig logic)
    const { data: settingsData } = await supabase
        .from('project_settings')
        .select('*')
        .eq('project_key', 'ainews')
        .in('key', [
            'telegram_bot_token',
            'tilda_cookies', 'tilda_project_id', 'tilda_feed_uid',
            'vk_access_token', 'vk_owner_id'
        ])

    if (!settingsData || settingsData.length === 0) {
        return NextResponse.json({ error: 'No settings found in project_settings' })
    }

    const DEFAULTS = {
        tilda_project_id: '7604066',
        tilda_feed_uid: '175116416341'
    }

    const config: any = {}
    const debugDefaultsUsed: any = {}

    settingsData.forEach((row: any) => {
        if (row.key === 'telegram_bot_token') config.telegram_bot_token = row.value
        if (row.key === 'tilda_cookies') config.tilda_cookies = row.value
        if (row.key === 'tilda_project_id') config.tilda_project_id = row.value
        if (row.key === 'tilda_feed_uid') config.tilda_feed_uid = row.value
    })

    // Apply defaults if missing
    if (!config.tilda_project_id) {
        config.tilda_project_id = DEFAULTS.tilda_project_id
        debugDefaultsUsed.tilda_project_id = true
    }
    if (!config.tilda_feed_uid) {
        config.tilda_feed_uid = DEFAULTS.tilda_feed_uid
        debugDefaultsUsed.tilda_feed_uid = true
    }

    if (!config.telegram_bot_token && !config.tilda_cookies) {
        return NextResponse.json({ error: 'Settings found but keys are missing (TG Token & Tilda Cookie)', settingsData })
    }

    const results: any = {}
    const testText = "ТЕСТ"
    // Use the File ID provided by user
    const testFileId = "AgACAgQAAyEGAAStM9_eAAIFXml-QaZO9NxF0v2IhcgtMixwlGmjAALrDWsbi7T0U0Ojcq0Ny71SAQADAgADeQADOAQ"
    const testChatId = "392453315"

    // 2. Resolve Image URL for Tilda from the File ID
    // We need a real URL for Tilda. We can get it via Telegram API if we have the token.
    let resolvedImageUrl = 'https://placehold.co/600x400?text=Test+Image' // Fallback

    try {
        if (config.telegram_bot_token) {
            const fileRes = await fetch(`https://api.telegram.org/bot${config.telegram_bot_token}/getFile?file_id=${testFileId}`)
            const fileData = await fileRes.json()

            if (fileData.ok && fileData.result.file_path) {
                // Construct the download URL
                // Note: This URL exposes the bot token, but it's server-to-server for Tilda upload, so acceptable for a test.
                resolvedImageUrl = `https://api.telegram.org/file/bot${config.telegram_bot_token}/${fileData.result.file_path}`
                results.image_resolving = { success: true, url: resolvedImageUrl }
            } else {
                results.image_resolving = { success: false, error: fileData }
            }
        }
    } catch (e: any) {
        results.image_resolving = { success: false, error: e.message }
    }

    // 3. Test Telegram (Directly using Publisher Class)
    try {
        if (!config.telegram_bot_token) {
            results.telegram = { success: false, error: 'No bot token in config' }
        } else {
            // Override Chat ID for test
            const tgPub = new TelegramPublisher(config.telegram_bot_token, testChatId)

            const res = await tgPub.publish({
                news_id: 'test-news-id',
                title: 'TEST TG',
                content_html: testText,
                image_url: testFileId, // Pass file_id directly for TG
                config: config
            })
            results.telegram = res
        }
    } catch (e: any) {
        results.telegram = { success: false, error: e.message }
    }

    // 4. Test Tilda (Directly using Publisher Class)
    try {
        if (config.tilda_cookies && config.tilda_project_id && config.tilda_feed_uid) {
            const tildaPub = new TildaPublisher(config.tilda_cookies, config.tilda_project_id, config.tilda_feed_uid)

            // Verify what cookies we are actually using
            results.debug_config = {
                ...results.debug_config,
                effective_tilda_cookie: (tildaPub as any).cookies
            }

            const res = await tildaPub.publish({
                news_id: 'test-news-id',
                title: 'TEST TILDA',
                content_html: `<p>${testText}</p>`, // Wrap in P for Tilda
                image_url: resolvedImageUrl, // Pass resolved URL for Tilda
                config: config
            })
            results.tilda = res
        } else {
            results.tilda = { success: false, error: 'Tilda config missing or incomplete' }
        }
    } catch (e: any) {
        results.tilda = { success: false, error: e.message }
    }

    if (!results.debug_config) results.debug_config = {};
    results.debug_config = {
        scan_results: settingsData.map((s: any) => ({
            key: s.key,
            value_type: typeof s.value,
            value_len: s.value ? String(s.value).length : 0,
            value_snippet: s.value ? String(s.value).substring(0, 5) + '...' : 'EMPTY'
        })),
        ...results.debug_config
    }

    return NextResponse.json(results, { pretty: true } as any)
}
