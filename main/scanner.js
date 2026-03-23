const fs = require('fs')
const path = require('path')

const SKIP_EXE = [
  /setup/i, /install/i, /unins/i, /crash/i, /report/i,
  /helper/i, /update/i, /patch/i, /vc_red/i, /dxsetup/i,
  /oalinst/i, /dotnet/i, /directx/i, /redist/i, /prereq/i,
  /launcher/i, /UE4/i, /UE5/i, /EasyAntiCheat/i, /BEService/i,
  /vcredist/i, /PhysX/i, /cef/i, /steam_api/i,
]

function isGameExe(name) {
  return !SKIP_EXE.some((p) => p.test(name))
}

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
    .filter((t) => t.length > 1 && !/^\d+$/.test(t))
}

function scoreExeCandidate(candidate, gameName, gameFolder) {
  const exeBase = path.basename(candidate.exeName, '.exe')
  const exeTokens = nameTokens(exeBase)
  const gameTokens = nameTokens(gameName)
  const exeNorm = normalizeName(exeBase)
  const gameNorm = normalizeName(gameName)
  let score = 0

  score += Math.max(0, 40 - candidate.depth * 8)
  if (exeNorm === gameNorm) score += 90

  const overlap = gameTokens.filter((t) => exeTokens.includes(t)).length
  score += overlap * 18
  if (gameTokens.length) score += Math.round((overlap / gameTokens.length) * 20)

  if (/^(start|play|run|game|client|launcher|bootstrap)$/i.test(exeBase)) score -= 35
  if (/launcher|bootstrap|updater|patcher/i.test(exeBase)) score -= 20

  const relativeExe = path.relative(gameFolder, candidate.exe)
  if (!relativeExe.includes(path.sep)) score += 6

  return score
}

function collectExes(dir, depth = 0) {
  if (depth > 4) return []
  const found = []
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const e of entries) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) {
        found.push(...collectExes(full, depth + 1))
      } else if (e.isFile() && e.name.toLowerCase().endsWith('.exe') && isGameExe(e.name)) {
        found.push({ exe: full, exeName: e.name, depth })
      }
    }
  } catch {}
  return found
}

function pickBestExe(exes, gameName, gameFolder) {
  if (!exes.length) return null
  exes.sort((a, b) => {
    const scoreDiff = scoreExeCandidate(b, gameName, gameFolder) - scoreExeCandidate(a, gameName, gameFolder)
    if (scoreDiff !== 0) return scoreDiff
    return a.depth - b.depth || b.exeName.length - a.exeName.length
  })
  return exes[0]
}

function calculateFolderSize(folderPath) {
  try {
    let totalBytes = 0
    const walk = (dir) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const e of entries) {
          try {
            const fullPath = path.join(dir, e.name)
            if (e.isFile()) {
              const stat = fs.statSync(fullPath)
              totalBytes += stat.size || 0
            } else if (e.isDirectory()) {
              walk(fullPath)
            }
          } catch {}
        }
      } catch {}
    }
    walk(folderPath)
    return totalBytes
  } catch {
    return 0
  }
}

function scanDir(dir) {
  const games = []
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const e of entries) {
      if (!e.isDirectory()) continue
      const gameFolder = path.join(dir, e.name)
      const gameName = e.name
        .replace(/\s*[\(\[]\d{4}[\)\]]/g, '')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      const exes = collectExes(gameFolder)
      const best = pickBestExe(exes, gameName, gameFolder)
      if (best) {
        games.push({
          name: gameName,
          exe: best.exe,
          folder: gameFolder,
          exeName: best.exeName,
          fileSize: calculateFolderSize(gameFolder),
        })
      }
    }
  } catch {}
  return games
}

module.exports = {
  scanDir,
  calculateFolderSize,
}
