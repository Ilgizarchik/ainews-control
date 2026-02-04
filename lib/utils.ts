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
