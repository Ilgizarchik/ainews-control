import { createClient } from '@/lib/supabase/client'
import { PublisherFactory } from './factory'
import type { Tables, TablesUpdate } from '@/types/database.types'
import { PublishContext, PublishResult } from './types'

const PUBLISH_PLATFORMS = ['tg', 'site', 'vk', 'ok', 'fb', 'threads', 'x', 'tilda'] as const
type PublishPlatform = typeof PUBLISH_PLATFORMS[number]

const isPublishPlatform = (platform: string | null): platform is PublishPlatform =>
    !!platform && PUBLISH_PLATFORMS.includes(platform as PublishPlatform)

type NewsItem = Tables<'news_items'>
type ReviewItem = Tables<'review_items'>
type PublishJob = Tables<'publish_jobs'>
type JobWithItems = PublishJob & {
    news_items?: NewsItem | null
    review_items?: ReviewItem | null
}

const isNewsItem = (item: NewsItem | ReviewItem): item is NewsItem =>
    'source_name' in item

export interface PublishSettings {
    telegram_bot_token?: string
    publish_chat_id?: string
    tilda_cookies?: string
    tilda_project_id?: string
    tilda_feed_uid?: string
    vk_access_token?: string
    vk_owner_id?: string
    ok_public_key?: string
    ok_access_token?: string
    ok_app_secret?: string
    ok_group_id?: string
    fb_access_token?: string
    fb_page_id?: string
    th_access_token?: string
    th_user_id?: string
    twitter_auth_token?: string
    twitter_proxy_url?: string // Added proxy support for Twitter
    safe_publish_mode?: boolean
    [key: string]: any
}

export class PublishService {
    private supabase = createClient()

    async processPublication(jobId: string): Promise<PublishResult> {

        // 1. Fetch job with item data
        const { data: job, error: jobError } = await this.supabase
            .from('publish_jobs')
            .select('*, news_items(*), review_items(*)')
            .eq('id', jobId)
            .single()

        if (jobError || !job) {
            return { success: false, error: `Job not found: ${jobError?.message}` }
        }

        const jobWithItems = job as JobWithItems
        const item = jobWithItems.news_items || jobWithItems.review_items
        if (!item) {
            return { success: false, error: 'Linked content (news or review) not found' }
        }

        // 2. Load Config from project_settings
        const { data: settingsData, error: settingsError } = await this.supabase
            .from('project_settings')
            .select('key, value')
            .eq('project_key', 'ainews')

        if (settingsError) {
            return { success: false, error: `Settings load error: ${settingsError.message}` }
        }

        const config: PublishSettings = {}
        const settingsRows = (settingsData as Array<{ key: string; value: string | null }> | null) ?? []
        settingsRows.forEach(row => {
            config[row.key] = row.value
        })

        // Check Safe Mode
        const isSafeMode = config.safe_publish_mode === true || String(config.safe_publish_mode) === 'true'
        if (isSafeMode) {
            // Simulate success
            const simulatedResult: PublishResult = {
                success: true,
                external_id: 'simulated_' + Date.now(),
                published_url: 'https://example.com/simulated'
            }
            await this.updateJobStatus(jobId, 'published', simulatedResult)
            return { success: true, external_id: 'simulated', published_url: 'https://example.com/simulated' }
        }

        // 3. Prepare Context
        const platformValue = jobWithItems.platform
        if (!isPublishPlatform(platformValue)) {
            return { success: false, error: `Unknown platform: ${platformValue ?? 'null'}` }
        }
        const platform = platformValue
        let title = item.draft_title || (isNewsItem(item) ? item.title : item.title_seed) || ''
        let content = item.draft_longread || item.draft_announce || (isNewsItem(item) ? item.rss_summary : '') || ''

        // Platform-specific content override
        if (platform === 'tg') content = item.draft_announce_tg || item.draft_announce || content
        if (platform === 'vk') content = item.draft_announce_vk || item.draft_announce || content
        if (platform === 'ok') content = item.draft_announce_ok || item.draft_announce || content
        if (platform === 'fb') content = item.draft_announce_fb || item.draft_announce || content
        if (platform === 'threads') content = item.draft_announce_threads || item.draft_announce || content
        if (platform === 'x') content = item.draft_announce_x || item.draft_announce || content

        // Image Resolution Priority
        let effectiveImageUrl = item.draft_image_url || (isNewsItem(item) ? item.image_url : null)

        // If draft_image_url is stable (e.g. Supabase), don't override with telegram.org
        const isStableUrl = effectiveImageUrl &&
            !effectiveImageUrl.includes('telegram.org') &&
            effectiveImageUrl.startsWith('http');

        if (item.draft_image_file_id && config.telegram_bot_token && !isStableUrl) {
            if (platform === 'tg') {
                // If we are posting to Telegram, just use the file_id directly
                effectiveImageUrl = item.draft_image_file_id
            } else {
                // For other platforms, we DO need a URL
                try {
                    const tgRes = await fetch(`https://api.telegram.org/bot${config.telegram_bot_token}/getFile?file_id=${item.draft_image_file_id}`)
                    const tgData = await tgRes.json()
                    if (tgData.ok && tgData.result?.file_path) {
                        effectiveImageUrl = `https://api.telegram.org/file/bot${config.telegram_bot_token}/${tgData.result.file_path}`
                    }
                } catch (e) {
                    console.error(`[PublishService] Failed to resolve prioritized file_id for ${platform}:`, e)
                }
            }
        }

        // Smart Link Logic: Check if the text ends with a colon
        const plainText = (content || '').replace(/<[^>]+>/g, '').trim()
        const shouldAttachLink = /:\s*[\s\S]*$/.test(plainText) && plainText.includes(':') && plainText.split(':').pop()?.trim().length === 0 || /:\s*[\uD800-\uDBFF\uDC00-\uDFFF\s]*$/.test(plainText)
        const linkPart = (shouldAttachLink && item.published_url) ? `\n${item.published_url}` : ''

        const context: PublishContext = {
            news_id: item.id,
            title: title,
            content_html: content + linkPart,
            image_url: effectiveImageUrl,
            source_url: item.published_url || '',
            config
        }

        // 4. Initialize Publisher
        try {
            const publisher = PublisherFactory.create(platform, config)
            if (!publisher) {
                const errRes = { success: false, error: `Missing credentials for platform ${platform}` }
                await this.updateJobStatus(jobId, 'failed', errRes)
                return errRes
            }
            const result = await publisher.publish(context)

            if (result.success) {
                await this.updateJobStatus(jobId, 'published', result)

                // SYNC BACK: If this was a website publish, save the stable Tilda URL to the item
                // and the published_url so other platforms can use it as a source link.
                if (platform === 'site' && result.raw_response) {
                    const tildaImage = result.raw_response.image || result.raw_response.thumb;
                    const table: 'news_items' | 'review_items' = jobWithItems.news_items ? 'news_items' : 'review_items';

                    const updateData: TablesUpdate<'news_items'> | TablesUpdate<'review_items'> = {};
                    if (tildaImage) updateData.draft_image_url = tildaImage;
                    if (result.published_url) updateData.published_url = result.published_url;

                    if (Object.keys(updateData).length > 0) {
                        await this.supabase
                            .from(table)
                            .update(updateData)
                            .eq('id', item.id);
                    }
                }
            } else {
                await this.updateJobStatus(jobId, 'failed', result)
            }

            return result
        } catch (e: any) {
            console.error(`[PublishService] Fatal during ${platform} publish:`, e)
            const errRes = { success: false, error: e.message }
            await this.updateJobStatus(jobId, 'failed', errRes)
            return errRes
        }
    }

    private async updateJobStatus(jobId: string, status: 'published' | 'failed', result: PublishResult) {
        const updates: TablesUpdate<'publish_jobs'> = {
            status,
            published_at_actual: status === 'published' ? new Date().toISOString() : null,
            error_message: result.error || null,
            external_id: result.external_id || null,
            published_url: result.published_url || null
        }

        await this.supabase
            .from('publish_jobs')
            .update(updates)
            .eq('id', jobId)
    }
}

export async function processPublishJob(jobId: string): Promise<PublishResult> {
    const service = new PublishService()
    return service.processPublication(jobId)
}
