import { Rettiwt } from 'rettiwt-api';
import { IPublisher, PublishContext, PublishResult } from './types';
import { ProxyAgent } from 'undici';
import { ClientTransaction } from 'x-client-transaction-id-glacier';
import { JSDOM } from 'jsdom';

interface TwitterSettings {
    twitter_token?: string;
    twitter_auth_token?: string;
    twitter_proxy_url?: string;
    proxy_url?: string;
    [key: string]: any;
}

export class TwitterPublisher implements IPublisher {
    private client: Rettiwt | null = null;
    private settings: TwitterSettings | null = null;
    private apiKey?: string;
    private proxyUrl?: string;

    constructor(apiKey?: string, proxyUrl?: string) {
        this.apiKey = apiKey;
        this.proxyUrl = proxyUrl;
    }

    async create(settings: TwitterSettings): Promise<this> {
        this.settings = settings;
        return this;
    }

    private stripHtml(html: string): string {
        if (!html) return '';
        return html
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>|<\/div>/gi, '\n')
            .replace(/<li>/gi, '\n- ')
            .replace(/<[^>]*>/g, '')
            .replace(/[ \t]+/g, ' ')
            .replace(/\n\s*\n/g, '\n\n')
            .trim();
    }

    private truncateText(text: string, maxLength: number = 280): string {
        if (text.length <= maxLength) return text;
        return text.slice(0, maxLength - 3).trimEnd() + '...';
    }

    private async getClientTransactionId(url: string, proxyAgent?: ProxyAgent): Promise<string | null> {
        try {
            const homepage = await fetch('https://x.com', {
                headers: {
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'
                },
                // @ts-ignore
                dispatcher: proxyAgent
            });
            const html = await homepage.text();
            const document = new JSDOM(html).window.document;
            const transaction = await ClientTransaction.create(document);
            const path = new URL(url).pathname.split('?')[0].trim();
            return await transaction.generateTransactionId('POST', path);
        } catch {
            return null;
        }
    }

    private resolveApiKey(context: PublishContext, settings?: TwitterSettings): string | undefined {
        return settings?.twitter_auth_token || settings?.twitter_token || this.apiKey || context.config?.twitter_auth_token || context.config?.twitter_token;
    }

    private resolveProxyUrl(context: PublishContext, settings?: TwitterSettings): string | undefined {
        return settings?.twitter_proxy_url || settings?.proxy_url || this.proxyUrl || context.config?.twitter_proxy_url || context.config?.proxy_url;
    }

    async publish(job: PublishContext, settings?: TwitterSettings): Promise<PublishResult> {

        // Используем либо настройки из БД, либо твой хардкод-ключ
        const apiKey = this.resolveApiKey(job, settings);
        const proxyUrl = this.resolveProxyUrl(job, settings);

        try {
            if (!apiKey) {
                return { success: false, error: 'Twitter Error: Missing auth token.' };
            }
            // 1. Настройка прокси

            // 2. Подготовка контента
            const title = (job.title || '').trim();
            const rawContent = job.content_html || (job as any).text || '';
            let rawBody = this.stripHtml(rawContent);
            const url = (job.source_url || '').trim();

            if (rawBody.includes('[LINK]')) {
                rawBody = rawBody.replace(/\[LINK\]/gi, url);
            }

            let fullText = rawBody; // Title is already in rawBody from AI
            fullText = this.truncateText(fullText, 280);

            // 3. Пытаемся через библиотеку
            const clientConfig: any = { apiKey: apiKey.trim(), timeout: 45000 };
            if (proxyUrl) clientConfig.proxyUrl = proxyUrl;
            this.client = new Rettiwt(clientConfig);
            try {
                const tweetId = await this.client.tweet.post({ text: fullText });
                if (tweetId) {
                    return { success: true, external_id: tweetId, published_url: `https://x.com/i/web/status/${tweetId}` };
                }
            } catch (libErr: any) {
                console.warn('[Twitter] Library failed or returned error, trying Manual Fallback...');
            }

            // 4. РУЧНОЙ FALLBACK (Имитация браузера)
            const decoded = Buffer.from(apiKey, 'base64').toString('utf-8');
            const ct0 = decoded.match(/ct0=([^;]+)/)?.[1] || '';

            // Собираем "чистые" куки для x.com
            const cleanCookie = decoded.trim().endsWith(';') ? decoded.trim() : `${decoded.trim()};`;

            const graphqlUrl = "https://x.com/i/api/graphql/z0m4Q8u_67R9VOSMXU_MWg/CreateTweet";

            const payload = {
                variables: {
                    tweet_text: fullText,
                    dark_request: false,
                    media: { media_entities: [], possibly_sensitive: false },
                    disallowed_reply_options: null,
                    semantic_annotation_ids: []
                },
                features: {
                    tweetypie_unmention_optimization_enabled: true,
                    responsive_web_edit_tweet_api_enabled: true,
                    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
                    view_counts_everywhere_api_enabled: true,
                    longform_notetweets_consumption_enabled: true,
                    responsive_web_twitter_article_tweet_consumption_enabled: true,
                    tweet_awards_web_tipping_enabled: false,
                    responsive_web_home_pinned_timelines_enabled: true,
                    freedom_of_speech_not_reach_fetch_enabled: true,
                    standardized_nudges_misinfo: true,
                    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
                    longform_notetweets_rich_text_read_enabled: true,
                    longform_notetweets_inline_media_enabled: true,
                    responsive_web_graphql_exclude_directive_enabled: true,
                    verified_phone_label_enabled: false,
                    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
                    responsive_web_graphql_timeline_navigation_enabled: true,
                    responsive_web_enhance_cards_enabled: false
                },
                queryId: "z0m4Q8u_67R9VOSMXU_MWg"
            };

            const proxyAgent = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;
            const transactionId = await this.getClientTransactionId(graphqlUrl, proxyAgent);
            const response = await fetch(graphqlUrl, {
                method: 'POST',
                headers: {
                    'authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
                    'cookie': cleanCookie,
                    'x-csrf-token': ct0,
                    'content-type': 'application/json',
                    'x-twitter-active-user': 'yes',
                    'x-twitter-auth-type': 'OAuth2Session',
                    'origin': 'https://x.com',
                    'referer': 'https://x.com/compose/post',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                    ...(transactionId ? { 'x-client-transaction-id': transactionId } : {})
                },
                body: JSON.stringify(payload),
                // @ts-ignore
                dispatcher: proxyAgent
            });

            const result: any = await response.json().catch(() => ({}));
            const primaryError = result?.errors?.[0];

            if (result?.data?.create_tweet?.tweet_results?.result?.rest_id) {
                const tweetId = result.data.create_tweet.tweet_results.result.rest_id;
                return { success: true, external_id: tweetId, published_url: `https://x.com/i/web/status/${tweetId}` };
            }

            // Если оба метода не сработали
            const errMsg = primaryError?.message || 'Authentication rejected by X.com';
            console.error('[Twitter] All methods failed. Primary error:', errMsg);

            if (primaryError?.code === 226) {
                return { success: false, error: 'Twitter Error: Automation detected (226). Try fresh cookies and a new client transaction id.' };
            }

            if (response.status === 401 || errMsg.includes('authenticate')) {
                return { success: false, error: 'Twitter Error: Session expired. Please update your Twitter token.' };
            }

            return { success: false, error: `Twitter Error: ${errMsg}` };

        } catch (error: any) {
            console.error('[Twitter] Critical Failure:', error.message);
            return { success: false, error: `Twitter Technical Error: ${error.message}` };
        }
    }
}
