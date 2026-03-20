import { describe, it, expect } from 'vitest'

const SKIP_EXE = [/setup/i,/install/i,/unins/i,/crash/i,/report/i,
                  /helper/i,/update/i,/patch/i,/vc_red/i,/dxsetup/i,
                  /oalinst/i,/dotnet/i,/directx/i,/redist/i,/prereq/i,
                  /launcher/i,/UE4/i,/UE5/i,/EasyAntiCheat/i,/BEService/i,
                  /vcredist/i,/PhysX/i,/cef/i,/steam_api/i]

function isGameExe(name) { return !SKIP_EXE.some(p => p.test(name)) }

function normalizeName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\.exe$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function nameTokens(s) {
  return normalizeName(s)
    .split(' ')
    .filter(t => t.length > 1 && !/^\d+$/.test(t))
}

function scoreExeCandidate(candidate, gameName, gameFolder) {
  const exeBase = candidate.exeName.replace(/\.exe$/i, '')
  const exeTokens = nameTokens(exeBase)
  const gameTokens = nameTokens(gameName)
  const exeNorm = normalizeName(exeBase)
  const gameNorm = normalizeName(gameName)
  let score = 0

  score += Math.max(0, 40 - candidate.depth * 8)
  if (exeNorm === gameNorm) score += 90

  const overlap = gameTokens.filter(t => exeTokens.includes(t)).length
  score += overlap * 18
  if (gameTokens.length) score += Math.round((overlap / gameTokens.length) * 20)

  if (/^(start|play|run|game|client|launcher|bootstrap)$/i.test(exeBase)) score -= 35
  if (/launcher|bootstrap|updater|patcher/i.test(exeBase)) score -= 20

  return score
}

describe('isGameExe', () => {
  it('should return false for setup executables', () => {
    expect(isGameExe('setup.exe')).toBe(false)
    expect(isGameExe('Setup.exe')).toBe(false)
  })

  it('should return false for install executables', () => {
    expect(isGameExe('install.exe')).toBe(false)
    expect(isGameExe('installer.exe')).toBe(false)
  })

  it('should return false for uninstall executables', () => {
    expect(isGameExe('unins000.exe')).toBe(false)
    expect(isGameExe('uninstall.exe')).toBe(false)
  })

  it('should return false for crash reporters', () => {
    expect(isGameExe('crashhandler.exe')).toBe(false)
    expect(isGameExe('CrashReporter.exe')).toBe(false)
  })

  it('should return false for redistributables', () => {
    expect(isGameExe('vcredist_x64.exe')).toBe(false)
    expect(isGameExe('dotnetfx.exe')).toBe(false)
    expect(isGameExe('directx_setup.exe')).toBe(false)
  })

  it('should return true for regular game executables', () => {
    expect(isGameExe('hollow_knight.exe')).toBe(true)
    expect(isGameExe('Celeste.exe')).toBe(true)
    expect(isGameExe('Hades.exe')).toBe(true)
  })
})

describe('normalizeName', () => {
  it('should convert to lowercase', () => {
    expect(normalizeName('Hollow Knight')).toBe('hollow knight')
    expect(normalizeName('CELESTE')).toBe('celeste')
  })

  it('should remove .exe extension', () => {
    expect(normalizeName('game.exe')).toBe('game')
    expect(normalizeName('GAME.EXE')).toBe('game')
  })

  it('should replace special characters with spaces', () => {
    expect(normalizeName('hollow_knight')).toBe('hollow knight')
    expect(normalizeName('game-name')).toBe('game name')
  })

  it('should collapse multiple spaces', () => {
    expect(normalizeName('  game   name  ')).toBe('game name')
  })

  it('should handle empty input', () => {
    expect(normalizeName('')).toBe('')
    expect(normalizeName(null)).toBe('')
    expect(normalizeName(undefined)).toBe('')
  })
})

describe('nameTokens', () => {
  it('should split into tokens', () => {
    expect(nameTokens('hollow knight')).toEqual(['hollow', 'knight'])
  })

  it('should filter out single characters', () => {
    expect(nameTokens('a b c')).toEqual([])
  })

  it('should filter out pure numbers', () => {
    expect(nameTokens('2024')).toEqual([])
    expect(nameTokens('game 123 name')).toEqual(['game', 'name'])
  })
})

describe('scoreExeCandidate', () => {
  it('should prefer shallower executables', () => {
    const shallow = { exeName: 'game.exe', depth: 0 }
    const deep = { exeName: 'game.exe', depth: 4 }
    const score1 = scoreExeCandidate(shallow, 'game', '/games')
    const score2 = scoreExeCandidate(deep, 'game', '/games')
    expect(score1).toBeGreaterThan(score2)
  })

  it('should give high score for exact name match', () => {
    const candidate = { exeName: 'hollow_knight.exe', depth: 0 }
    const score = scoreExeCandidate(candidate, 'hollow knight', '/games')
    expect(score).toBeGreaterThanOrEqual(130)
  })

  it('should penalize generic executable names', () => {
    const generic = { exeName: 'launcher.exe', depth: 0 }
    const specific = { exeName: 'hollow_knight.exe', depth: 0 }
    const scoreGeneric = scoreExeCandidate(generic, 'hollow knight', '/games')
    const scoreSpecific = scoreExeCandidate(specific, 'hollow knight', '/games')
    expect(scoreSpecific).toBeGreaterThan(scoreGeneric)
  })
})
