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
    const domain = source && source !== 'unknown' ? source : ''
    if (domain) {
      return `https://${domain.replace(/^https?:\/\//, '')}${url}`
    }
  }

  // If bit is something like "example.com/path" (no protocol)
  if (url.includes('.') && !url.startsWith('/')) {
    return `https://${url}`
  }

  return url
}
