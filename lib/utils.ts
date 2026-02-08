import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function ensureAbsoluteUrl(url: string | null | undefined, source?: string | null) {
  if (!url) return '#'
  if (url.startsWith('http://') || url.startsWith('https://')) return url

  // If it's a relative path starting with /
  if (url.startsWith('/')) {
    let domainStr = (source && source !== 'unknown' ? source : '').replace(/^https?:\/\//, '').toLowerCase()

    // Normalize known short source names to full domains
    if (!domainStr.includes('.')) {
      if (domainStr === 'ohotniki') domainStr = 'ohotniki.ru'
      if (domainStr.includes('huntportal')) domainStr = 'huntportal.ru'
      if (domainStr === 'mooir') domainStr = 'mooir.ru'
      if (domainStr === 'hunting') domainStr = 'hunting.ru'
    }

    if (domainStr) {
      // Ensure we don't have double slashes if url also starts with /
      return `https://${domainStr.replace(/\/$/, '')}/${url.replace(/^\//, '')}`
    }
  }

  // If bit is something like "example.com/path" (no protocol)
  if (url.includes('.') && !url.startsWith('/')) {
    return `https://${url}`
  }

  return url
}

export function convertBbcodeToHtml(text: string): string {
  if (!text) return ''
  return text
    // 1. Basic BBCode
    .replace(/\[b\]/gi, '<b>').replace(/\[\/b\]/gi, '</b>')
    .replace(/\[i\]/gi, '<i>').replace(/\[\/i\]/gi, '</i>')
    .replace(/\[u\]/gi, '<u>').replace(/\[\/u\]/gi, '</u>')
    .replace(/\[s\]/gi, '<s>').replace(/\[\/s\]/gi, '</s>')
    .replace(/\[code\]/gi, '<code>').replace(/\[\/code\]/gi, '</code>')
    .replace(/\[url=(.*?)\](.*?)\[\/url\]/gi, '<a href="$1">$2</a>')
    .replace(/\[url\](.*?)\[\/url\]/gi, '<a href="$1">$1</a>')
    // 2. HTML Cleanup (Telegram doesn't support <p>, <br>, <div>)
    // Replace <p> with nothing (just start) and </p> with double newline
    .replace(/<p[^>]*>/gi, '').replace(/<\/p>/gi, '\n\n')
    // Replace <br> with newline
    .replace(/<br\s*\/?>/gi, '\n')
    // Remove unsupported tags but keep content
    .replace(/<\/?div[^>]*>/gi, '')
    .replace(/<\/?span[^>]*>/gi, '')
    // Cleanup multiple newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
