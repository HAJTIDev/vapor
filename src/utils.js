/**
 * Formatting utilities for Vapor
 */

export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B'
  if (bytes == null) return 'Unknown'
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  
  const decimals = unitIndex === 0 ? 0 : 1
  return `${size.toFixed(decimals)} ${units[unitIndex]}`
}

export function formatTime(mins) {
  if (!mins) return '0h'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`
}

export function formatDate(ts) {
  if (!ts) return 'Never'
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function sanitizeSteamAppId(input) {
  const raw = String(input || '').trim()
  if (!raw) return ''

  if (/^\d+$/.test(raw)) return raw

  const decoded = (() => {
    try {
      return decodeURIComponent(raw)
    } catch {
      return raw
    }
  })()

  const patterns = [
    /store\.steampowered\.com\/app\/(\d+)/i,
    /steam:\/\/run\/(\d+)/i,
    /steam:\/\/rungameid\/(\d+)/i,
  ]

  for (const pattern of patterns) {
    const match = decoded.match(pattern)
    if (match?.[1]) return match[1]
  }

  const fallback = decoded.match(/\b(\d{3,})\b/)
  return fallback?.[1] || ''
}
