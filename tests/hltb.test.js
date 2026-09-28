import { describe, it, expect } from 'vitest'
const { cleanTitle, formatHours } = require('../main/hltb.js')

describe('cleanTitle', () => {
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

describe('formatHours', () => {
  it('should format seconds to hours properly', () => {
    expect(formatHours(3600)).toBe('1h')
    expect(formatHours(7200)).toBe('2h')
    expect(formatHours(97110)).toBe('27h')
    expect(formatHours(30884)).toBe('8.5h')
  })

  it('should format sub-hour playtimes as minutes', () => {
    expect(formatHours(1800)).toBe('30m')
    expect(formatHours(600)).toBe('10m')
  })

  it('should return null for invalid or zero inputs', () => {
    expect(formatHours(0)).toBe(null)
    expect(formatHours(-10)).toBe(null)
    expect(formatHours(null)).toBe(null)
  })
})
