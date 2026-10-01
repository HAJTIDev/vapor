import { describe, it, expect } from 'vitest'
const { cleanTitle, searchPcgw } = require('../main/pcgamingwiki.js')

describe('PCGamingWiki cleanTitle', () => {
  it('should clean brackets, version numbers, and release noise', () => {
    expect(cleanTitle('Hollow Knight [FitGirl Repack]')).toBe('Hollow Knight')
    expect(cleanTitle('Celeste v1.4.0 (GOG)')).toBe('Celeste')
    expect(cleanTitle('Cyberpunk 2077 - Deluxe Edition')).toBe('Cyberpunk 2077')
    expect(cleanTitle('Hades_Remastered')).toBe('Hades')
  })

  it('should handle simple game names without modifications', () => {
    expect(cleanTitle('Portal 2')).toBe('Portal 2')
    expect(cleanTitle('Elden Ring')).toBe('Elden Ring')
  })

  it('should handle empty or null values', () => {
    expect(cleanTitle('')).toBe('')
    expect(cleanTitle(null)).toBe('')
  })
})

describe('searchPcgw', () => {
  it('handles empty query gracefully', async () => {
    const res = await searchPcgw('')
    expect(res.ok).toBe(false)
    expect(res.found).toBe(false)
  })
})
