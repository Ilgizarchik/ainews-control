import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function ensureAbsoluteUrl(url: string | null | undefined, source?: string | null) {
  if (!url) return '#'
  if (url.startsWith('http://') || url.startsWith('https://')) return url

  // Если это относительный путь, начинающийся с /
  if (url.startsWith('/')) {
    let domainStr = (source && source !== 'unknown' ? source : '').replace(/^https?:\/\//, '').toLowerCase()

    // Нормализуем короткие названия источников в полные домены
    if (!domainStr.includes('.')) {
      if (domainStr === 'ohotniki') domainStr = 'ohotniki.ru'
      if (domainStr.includes('huntportal')) domainStr = 'huntportal.ru'
      if (domainStr === 'mooir') domainStr = 'mooir.ru'
      if (domainStr === 'hunting') domainStr = 'hunting.ru'
    }

    if (domainStr) {
      // Убеждаемся, что не получится двойных слешей, если url тоже начинается с /
      return `https://${domainStr.replace(/\/$/, '')}/${url.replace(/^\//, '')}`
    }
  }

  // Если это что-то вроде "example.com/path" (без протокола)
  if (url.includes('.') && !url.startsWith('/')) {
    return `https://${url}`
  }

  return url
}

export function convertBbcodeToHtml(text: string): string {
  if (!text) return ''
  return text
    // 1. Базовый BBCode
    .replace(/\[b\]/gi, '<b>').replace(/\[\/b\]/gi, '</b>')
    .replace(/\[i\]/gi, '<i>').replace(/\[\/i\]/gi, '</i>')
    .replace(/\[u\]/gi, '<u>').replace(/\[\/u\]/gi, '</u>')
    .replace(/\[s\]/gi, '<s>').replace(/\[\/s\]/gi, '</s>')
    .replace(/\[code\]/gi, '<code>').replace(/\[\/code\]/gi, '</code>')
    .replace(/\[url=(.*?)\](.*?)\[\/url\]/gi, '<a href="$1">$2</a>')
    .replace(/\[url\](.*?)\[\/url\]/gi, '<a href="$1">$1</a>')
    // 2. Очистка HTML (Telegram не поддерживает <p>, <br>, <div>)
    // Заменяем <p> на пустоту, а </p> — на двойной перенос строки
    .replace(/<p[^>]*>/gi, '').replace(/<\/p>/gi, '\n\n')
    // Заменяем <br> на перенос строки
    .replace(/<br\s*\/?>/gi, '\n')
    // Удаляем неподдерживаемые теги, сохраняя контент
    .replace(/<\/?div[^>]*>/gi, '')
    .replace(/<\/?span[^>]*>/gi, '')
    // Очищаем множественные переводы строк
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
