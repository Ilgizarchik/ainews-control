'use server'

import { createClient } from "@/lib/supabase/server"
import { PublisherConfig, PublisherFactory } from "@/lib/publishers/factory"
import { PublishContext } from "@/lib/publishers/types"

async function getPublisherConfig(projectKey: string = 'ainews'): Promise<PublisherConfig> {
    const supabase = await createClient()
    const { data } = await supabase
        .from('project_settings')
        .select('*')
        .eq('project_key', projectKey)
        .eq('is_active', true)
        .in('key', [
            'telegram_bot_token',
            'tilda_cookies', 'tilda_project_id', 'tilda_feed_uid',
            'vk_access_token', 'vk_api_version', 'vk_owner_id',
            'ok_public_key', 'ok_access_token', 'ok_app_secret', 'ok_group_id',
            'fb_access_token', 'fb_page_id',
            'th_access_token', 'th_user_id',
            'twitter_auth_token',
            'ai_proxy_url',
            'ai_proxy_enabled',
            'telegram_channel_id',
            'publish_chat_id',
            'telegram_disable_link_preview'
        ])

    if (!data) return {};

    const config: PublisherConfig = {}

    // 2. Map basic settings
    data.forEach((row: any) => {
        if (row.key === 'telegram_bot_token') config.telegram_bot_token = row.value
        if (row.key === 'tilda_cookies') config.tilda_cookies = row.value
        if (row.key === 'tilda_project_id') config.tilda_project_id = row.value
        if (row.key === 'tilda_feed_uid') config.tilda_feed_uid = row.value
        if (row.key === 'vk_access_token') config.vk_access_token = row.value
        if (row.key === 'vk_api_version') config.vk_api_version = row.value
        if (row.key === 'vk_owner_id') config.vk_owner_id = row.value
        if (row.key === 'ok_public_key') config.ok_public_key = row.value
        if (row.key === 'ok_access_token') config.ok_access_token = row.value
        if (row.key === 'ok_app_secret') config.ok_app_secret = row.value
        if (row.key === 'ok_group_id') config.ok_group_id = row.value
        if (row.key === 'fb_access_token') config.fb_access_token = row.value
        if (row.key === 'fb_page_id') config.fb_page_id = row.value
        if (row.key === 'th_access_token') config.th_access_token = row.value
        if (row.key === 'th_user_id') config.th_user_id = row.value
        if (row.key === 'twitter_auth_token') config.twitter_auth_token = row.value
        if (row.key === 'ai_proxy_url') config.ai_proxy_url = row.value
        if (row.key === 'ai_proxy_enabled') config.ai_proxy_enabled = row.value === 'true'
        if (row.key === 'telegram_disable_link_preview') config.telegram_disable_link_preview = row.value === 'true'
        // Priority to UI set key
        if (row.key === 'publish_chat_id' || row.key === 'telegram_channel_id') {
            config.telegram_channel_id = row.value
        }
    })

    // 3. Fallback to telegram_chats table ONLY if not set in project_settings
    if (!config.telegram_channel_id) {
        const { data: chats } = await supabase
            .from('telegram_chats')
            .select('chat_id')
            .eq('purpose', 'publish')
            .eq('project_key', projectKey)
            .eq('is_active', true)
            .single()

        if (chats) {
            config.telegram_channel_id = (chats as any).chat_id
        }
    }

    return config;
}

// Helper to create a job log
async function createJob(supabase: any, newsId: string | null, platform: string, reviewId: string | null, status: 'processing' | 'queued' = 'processing', publishAt: string = new Date().toISOString()) {
    const { data, error } = await supabase.from('publish_jobs').insert({
        news_id: newsId || null,
        review_id: reviewId || null,
        platform: platform,
        status: status,
        created_at: new Date().toISOString(),
        publish_at: publishAt
    }).select('id').single();

    if (error) console.error('Error creating job', error);
    return data?.id;
}

async function updateJob(supabase: any, jobId: string, status: 'published' | 'error', externalId?: string, errorMsg?: string) {
    if (!jobId) return;

    const { data: current } = await supabase
        .from('publish_jobs')
        .select('retry_count, published_at_actual')
        .eq('id', jobId)
        .single();

    const currentRetry = current?.retry_count || 0;

    const updates: any = {
        status,
        external_id: externalId || null,
        error_message: errorMsg || null,
        updated_at: new Date().toISOString()
    };

    if (status === 'published') {
        updates.published_at_actual = new Date().toISOString();
    } else {
        updates.retry_count = currentRetry + 1;
    }

    await supabase.from('publish_jobs').update(updates).eq('id', jobId);
}

export async function publishItem(itemId: string, itemType: 'news' | 'review' = 'news', publishAt?: string) {
    const supabase = await createClient()

    // 1. Fetch Item
    const table = itemType === 'news' ? 'news_items' : 'review_items';
    const { data: itemRaw, error } = await supabase
        .from(table)
        .select(`
            id, title, draft_title, content, draft_longread, draft_longread_site, 
            draft_image_url, image_url, draft_image_file_id, draft_announce_tg, draft_announce_vk, 
            draft_announce_ok, draft_announce_fb, draft_announce_x, 
            draft_announce_threads, draft_announce_site, draft_announce, published_url
        `)
        .eq('id', itemId)
        .single();

    if (error || !itemRaw) {
        return { success: false, error: 'Item not found' };
    }
    const item = itemRaw as any;

    const config = await getPublisherConfig();
    const title = item.draft_title || 'No Title';
    const siteHtml = item.draft_longread_site || item.draft_longread || '<p>No Content</p>';
    const tgText = item.draft_announce_tg || item.draft_announce || siteHtml;
    const vkText = item.draft_announce_vk || item.draft_announce || siteHtml;
    const okText = item.draft_announce_ok || item.draft_announce || siteHtml;
    const fbText = item.draft_announce_fb || item.draft_announce || siteHtml;
    const thText = item.draft_announce_threads || item.draft_announce || siteHtml;
    const twitterText = item.draft_announce_x || item.draft_announce || siteHtml;

    // Smart Image Prep
    let effectiveImageUrl = item.draft_image_url || item.image_url;
    const isStable = (url: string) => !!(url && url.startsWith('http') && !url.includes('telegram.org'));
    const currentIsStable = isStable(item.draft_image_url) || isStable(item.image_url);

    let publishedUrl = item.published_url || '';
    const results: any = {};

    const isScheduled = !!publishAt;
    const initialStatus = isScheduled ? 'queued' : 'processing';
    const effectivePublishAt = publishAt || new Date().toISOString();

    // Helper for sequential resolution of images only when needed
    const resolveImageUrl = async (platform: string) => {
        if (currentIsStable) return effectiveImageUrl;
        if (item.draft_image_file_id && config.telegram_bot_token) {
            if (platform === 'tg') return item.draft_image_file_id;
            try {
                const tgRes = await fetch(`https://api.telegram.org/bot${config.telegram_bot_token}/getFile?file_id=${item.draft_image_file_id}`)
                const tgData = await tgRes.json()
                if (tgData.ok && tgData.result?.file_path) {
                    return `https://api.telegram.org/file/bot${config.telegram_bot_token}/${tgData.result.file_path}`
                }
            } catch (e) { console.error('TG resolve error', e) }
        }
        return effectiveImageUrl;
    }

    // --- SITE ---
    if (config.tilda_cookies) {
        const platform = 'site';
        const jobId = await createJob(supabase, itemType === 'news' ? itemId : null, platform, itemType === 'review' ? itemId : null, initialStatus, effectivePublishAt);
        if (!isScheduled) {
            try {
                const pub = PublisherFactory.create(platform, config);
                if (!pub) throw new Error(`${platform} publisher not configured`);
                const context: PublishContext = {
                    news_id: itemId,
                    title: title,
                    content_html: siteHtml,
                    image_url: await resolveImageUrl(platform),
                    config
                };
                const res = await pub.publish(context);
                results[platform] = res;
                if (res.success) {
                    publishedUrl = res.published_url || publishedUrl;
                    await updateJob(supabase, jobId, 'published', res.external_id);

                    // Sync back stable URL and main link
                    const updateData: any = { published_url: publishedUrl, status: 'published', published_at: new Date().toISOString() };
                    const raw = res.raw_response;
                    const tildaImg = raw?.image || raw?.thumb || raw?.post?.image || raw?.post?.thumb;
                    if (tildaImg) updateData.draft_image_url = tildaImg;

                    await (supabase as any).from(table).update(updateData).eq('id', itemId);
                } else {
                    await updateJob(supabase, jobId, 'error', undefined, res.error);
                }
            } catch (e: any) {
                results[platform] = { success: false, error: e.message };
                await updateJob(supabase, jobId, 'error', undefined, e.message);
            }
        }
    }

    // --- OTHER PLATFORMS (Loop) ---
    const socialPlatforms = [
        { key: 'tg', text: tgText, active: !!(config.telegram_bot_token && config.telegram_channel_id) },
        { key: 'vk', text: vkText, active: !!(config.vk_access_token && config.vk_owner_id) },
        { key: 'ok', text: okText, active: !!(config.ok_access_token && config.ok_group_id) },
        { key: 'fb', text: fbText, active: !!(config.fb_access_token && config.fb_page_id) },
        { key: 'threads', text: thText, active: !!(config.th_access_token && config.th_user_id) },
        { key: 'x', text: twitterText, active: !!(config.twitter_auth_token) }
    ];

    for (const p of socialPlatforms) {
        if (!p.active) continue;
        const jobId = await createJob(supabase, itemType === 'news' ? itemId : null, p.key, itemType === 'review' ? itemId : null, initialStatus, effectivePublishAt);
        if (!isScheduled) {
            try {
                const pub = PublisherFactory.create(p.key as any, config);
                if (!pub) throw new Error(`${p.key} publisher not configured`);
                const res = await pub.publish({
                    news_id: itemId,
                    title: title,
                    content_html: p.text,
                    image_url: await resolveImageUrl(p.key),
                    source_url: publishedUrl,
                    config
                });
                results[p.key] = res;
                if (res.success) {
                    await updateJob(supabase, jobId, 'published', res.external_id);
                } else {
                    await updateJob(supabase, jobId, 'error', undefined, res.error);
                }
            } catch (e: any) {
                results[p.key] = { success: false, error: e.message };
                await updateJob(supabase, jobId, 'error', undefined, e.message);
            }
        } else {
            results[p.key] = { success: true, status: 'scheduled' };
        }
    }

    return { success: true, results, publishedUrl, isScheduled };
}

export async function publishSinglePlatform({ itemId, itemType, platform, content, bypassSafeMode = false, isTest = false }: {
    itemId: string;
    itemType: 'news' | 'review';
    platform: string;
    content: string;
    bypassSafeMode?: boolean;
    isTest?: boolean;
}) {
    const supabase = await createClient()
    const config = await getPublisherConfig()

    const { data: safeModeSetting } = await supabase.from('project_settings').select('value').eq('key', 'safe_publish_mode').single() as any
    const isSafeMode = (safeModeSetting?.value === 'true') && !bypassSafeMode

    if (isSafeMode) return { success: true, simulated: true, platform }

    try {
        const publisher = PublisherFactory.create(platform as any, config)
        if (!publisher) throw new Error(`Publisher for ${platform} not configured`)

        const table = itemType === 'news' ? 'news_items' : 'review_items'
        const { data: item } = await supabase.from(table).select('*').eq('id', itemId).single() as any

        let effectiveImageUrl = item?.draft_image_url || item?.image_url;

        // --- STABLE IMAGE CHECK ---
        const isStable = (url: string) => !!(url && url.startsWith('http') && !url.includes('telegram.org'));
        const currentIsStable = isStable(item?.draft_image_url) || isStable(item?.image_url);

        if (item?.draft_image_file_id && config.telegram_bot_token && !currentIsStable) {
            if (platform === 'tg') {
                effectiveImageUrl = item.draft_image_file_id;
            } else {
                try {
                    const res = await fetch(`https://api.telegram.org/bot${config.telegram_bot_token}/getFile?file_id=${item.draft_image_file_id}`)
                    const data = await res.json()
                    if (data.ok && data.result?.file_path) {
                        effectiveImageUrl = `https://api.telegram.org/file/bot${config.telegram_bot_token}/${data.result.file_path}`
                    }
                } catch (e) { console.error("[PublishSingle] File resolve error:", e) }
            }
        }

        const res = await publisher.publish({
            news_id: itemId,
            title: item?.draft_title || item?.title || 'No Title',
            content_html: content,
            image_url: effectiveImageUrl,
            source_url: item?.published_url || '',
            config
        })

        if (res.success) {
            const itemUpdate: any = {}

            // Всегда сохраняем ссылку для сайта (даже в тесте), чтобы ТГ её подхватил
            if (platform === 'site' || platform === 'tilda') {
                itemUpdate.published_url = res.published_url

                // Статус и время публикации обновляем только при реальной публикации
                if (!isTest) {
                    itemUpdate.status = 'published'
                    itemUpdate.published_at = new Date().toISOString()
                }

                // Синхронизируем стабильную картинку с Тильды
                const raw = res.raw_response;
                const tildaImg = raw?.image || raw?.thumb || raw?.post?.image || raw?.post?.thumb;
                if (tildaImg && tildaImg.startsWith('http')) {
                    itemUpdate.draft_image_url = tildaImg;
                }
            }

            // Если не тест, или если это тест сайта (для сохранения ссылки), обновляем запись
            if (!isTest || platform === 'site' || platform === 'tilda') {
                if (Object.keys(itemUpdate).length > 0) {
                    await (supabase as any).from(table).update(itemUpdate).eq('id', itemId)
                }
            }

            // Обновление логов джобы только для реальной публикации
            if (!isTest) {
                // Sync Job with correct URL and ID
                const { data: existingJobs } = await supabase.from('publish_jobs').select('id').eq(itemType === 'news' ? 'news_id' : 'review_id', itemId).eq('platform', platform).order('created_at', { ascending: false }).limit(1) as any
                const jobId = existingJobs?.[0]?.id
                const now = new Date().toISOString()

                const jobPayload: any = {
                    status: 'published',
                    external_id: res.external_id,
                    published_url: res.published_url,
                    social_content: content,
                    published_at_actual: now,
                    updated_at: now
                }

                if (jobId) {
                    await (supabase as any).from('publish_jobs').update(jobPayload).eq('id', jobId)
                } else {
                    await (supabase as any).from('publish_jobs').insert({
                        [itemType === 'news' ? 'news_id' : 'review_id']: itemId,
                        platform,
                        ...jobPayload,
                        publish_at: now
                    })
                }
            }
        }

        return { ...res, platform }
    } catch (e: any) {
        return { success: false, error: e.message, platform }
    }
}

/**
 * @deprecated This function is no longer called automatically.
 * Jobs remain in the queue even if their platform recipes are disabled,
 * allowing manual management of the publication queue.
 * Can be used manually if cleanup is needed.
 */
export async function cleanupDisabledPlatforms() {
    try {
        const supabase = await createClient()

        // 1. Получаем список активных платформ из рецептов
        const { data: recipes, error: recipesError } = await supabase
            .from('publish_recipes')
            .select('platform')
            .eq('is_active', true)

        if (recipesError) throw recipesError

        const activePlatforms = (recipes as any[])?.map(r => r.platform.toLowerCase()) || []

        // Всегда оставляем 'site' как системную платформу
        if (!activePlatforms.includes('site')) activePlatforms.push('site')


        // 2. Удаляем запланированные задачи для отключенных платформ
        const { error: deleteError, count } = await supabase
            .from('publish_jobs')
            .delete({ count: 'exact' })
            .not('platform', 'in', `(${activePlatforms.join(',')})`)
            .neq('status', 'published')

        if (deleteError) {
            console.error('[Cleanup] Delete error:', deleteError)
            return { success: false, error: deleteError.message }
        }

        return { success: true, deletedCount: count ?? 0 }
    } catch (e: any) {
        console.error('[Cleanup] Critical error:', e)
        return { success: false, error: e.message }
    }
}
