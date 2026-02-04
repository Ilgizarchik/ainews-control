export type PublishContext = {
    news_id: string
    title: string
    content_html: string
    image_url?: string | null
    source_url?: string // Ссылка на оригинал
    // Настройки конкретной интеграции
    config: any
}

export type PublishResult = {
    success: boolean
    external_id?: string
    published_url?: string
    error?: string
    raw_response?: any
}

export interface IPublisher {
    publish(context: PublishContext): Promise<PublishResult>
}
