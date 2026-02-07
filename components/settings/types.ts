export type AIConfig = {
    provider: string
    model: string
    baseUrl: string
    proxyUrl: string
    useProxy: boolean
    imageProvider: string
    imageModel: string
    autoGenerateSocial: boolean
}

export type ApiKeys = {
    openrouter: string
    openai: string
    anthropic: string
    custom: string
    telegram_bot_token: string
    publish_chat_id: string
    telegram_draft_chat_id: string
    tilda_cookies: string
    tilda_project_id: string
    tilda_feed_uid: string
    vk_access_token: string
    vk_owner_id: string
    ok_public_key: string
    ok_access_token: string
    ok_app_secret: string
    ok_group_id: string
    fb_access_token: string
    fb_page_id: string
    th_access_token: string
    th_user_id: string
    twitter_auth_token: string
    twitter_proxy_url: string
    telegram_error_chat_id: string
} & Record<string, string>

export type IngestSchedule = {
    mode: string
    value: string
    days: string[]
}
