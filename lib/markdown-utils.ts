// Helper: Detect if content is markdown
export function isMarkdown(text: string): boolean {
    if (!text) return false
    // Check for common markdown patterns
    const markdownPatterns = [
        /^#{1,6}\s/m,           // Headers
        /\*\*.*\*\*/,            // Bold
        /\*.*\*/,                // Italic
        /^\* /m,                 // Unordered list
        /^\d+\. /m,              // Ordered list
        /\[.*\]\(.*\)/,          // Links
        /^```/m,                 // Code blocks
        /^> /m                  // Blockquotes
    ]
    return markdownPatterns.some(pattern => pattern.test(text))
}

// Helper: Convert markdown to HTML
export function markdownToHtml(markdown: string): string {
    if (!markdown) return ''

    let html = markdown

    // Headers
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>')
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>')
    html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>')

    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')

    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')

    // Strikethrough
    html = html.replace(/~~(.*?)~~/g, '<del>$1</del>')

    // Links
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')

    // Unordered lists
    html = html.replace(/^\* (.+)$/gm, '<li>$1</li>')
    html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')

    // Ordered lists
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>')

    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')

    // Inline code
    html = html.replace(/`(.*?)`/g, '<code>$1</code>')

    // Blockquotes
    html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')

    // Line breaks
    html = html.replace(/\n\n/g, '</p><p>')
    html = `<p>${html}</p>`

    return html
}
