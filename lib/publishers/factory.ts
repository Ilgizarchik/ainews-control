import { IPublisher, PublishContext, PublishResult } from './types'
import { TelegramPublisher } from './telegram'
import { VkPublisher } from './vk'
import { TildaPublisher } from './tilda'
import { FacebookPublisher } from './facebook';
import { ThreadsPublisher } from './threads';
import { TwitterPublisher } from './twitter';
import { OkPublisher } from './ok'

export type PublisherConfig = {
    // API-ключи (из настроек)
    telegram_bot_token?: string
    tilda_cookies?: string
    tilda_project_id?: string
    tilda_feed_uid?: string
    vk_access_token?: string
    vk_api_version?: string
    vk_owner_id?: string

    // OK.RU
    ok_public_key?: string
    ok_access_token?: string
    ok_app_secret?: string
    ok_group_id?: string

    // Facebook
    fb_access_token?: string
    fb_page_id?: string

    // Threads
    th_access_token?: string
    th_user_id?: string

    // Twitter (скрейпер)
    twitter_auth_token?: string
    // Глобальный прокси
    ai_proxy_url?: string
    ai_proxy_enabled?: boolean
    // Маршрутизация/ID чатов
    telegram_channel_id?: string
    telegram_disable_link_preview?: boolean
}

export class PublisherFactory {
    static create(platform: 'tg' | 'site' | 'vk' | 'ok' | 'fb' | 'threads' | 'x' | 'tilda', config: PublisherConfig): IPublisher | null {
        switch (platform) {
            case 'tg':
                if (!config.telegram_bot_token) return null;
                return new TelegramPublisher(config.telegram_bot_token, config.telegram_channel_id);

            case 'site':
            case 'tilda':
                if (!config.tilda_cookies || !config.tilda_project_id || !config.tilda_feed_uid) return null;
                return new TildaPublisher(config.tilda_cookies, config.tilda_project_id, config.tilda_feed_uid);

            case 'vk':
                if (!config.vk_access_token || !config.vk_owner_id) return null;
                return new VkPublisher(config.vk_access_token, config.vk_owner_id, config.vk_api_version, config.ai_proxy_enabled ? config.ai_proxy_url : undefined);

            case 'ok':
                if (!config.ok_access_token || !config.ok_public_key || !config.ok_app_secret || !config.ok_group_id) return null;
                return new OkPublisher(config.ok_access_token, config.ok_public_key, config.ok_app_secret, config.ok_group_id, config.ai_proxy_enabled ? config.ai_proxy_url : undefined);

            case 'fb':
                if (!config.fb_access_token || !config.fb_page_id) return null;
                return new FacebookPublisher(config.fb_access_token, config.fb_page_id);

            case 'threads':
                if (!config.th_access_token) return null;
                return new ThreadsPublisher(config.th_access_token, config.th_user_id);

            case 'x':
                if (!config.twitter_auth_token) return null;
                return new TwitterPublisher(config.twitter_auth_token, config.ai_proxy_url);

            default:
                return null;
        }
    }
}
