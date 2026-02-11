// Хелпер: проверяем, что контент — это markdown
export function isMarkdown(text: string): boolean {
    if (!text) return false
    // Проверяем типичные паттерны markdown
    const markdownPatterns = [
        /^#{1,6}\s/m,           // Заголовки
        /\*\*.*\*\*/,            // Жирный
        /\*.*\*/,                // Курсив
        /^\* /m,                 // Маркированный список
        /^\d+\. /m,              // Нумерованный список
        /\[.*\]\(.*\)/,          // Ссылки
        /^```/m,                 // Блоки кода
        /^> /m                  // Цитаты
    ]
    return markdownPatterns.some(pattern => pattern.test(text))
}

// Хелпер: конвертируем markdown в HTML
export function markdownToHtml(markdown: string): string {
    if (!markdown) return ''

    let html = markdown

    // Заголовки
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>')
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>')
    html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>')

    // Жирный
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')

    // Курсив
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')

    // Зачеркнутый
    html = html.replace(/~~(.*?)~~/g, '<del>$1</del>')

    // Ссылки
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')

    // Маркированные списки
    html = html.replace(/^\* (.+)$/gm, '<li>$1</li>')
    html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')

    // Нумерованные списки
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>')

    // Блоки кода
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')

    // Инлайн-код
    html = html.replace(/`(.*?)`/g, '<code>$1</code>')

    // Цитаты
    html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')

    // Переводы строк
    html = html.replace(/\n\n/g, '</p><p>')
    html = `<p>${html}</p>`

    return html
}
