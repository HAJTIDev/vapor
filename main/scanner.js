const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const SKIP_EXE = [
  /setup/i, /install/i, /unins/i, /crash/i, /report/i,
  /helper/i, /update/i, /patch/i, /vc_red/i, /dxsetup/i,
  /oalinst/i, /dotnet/i, /directx/i, /redist/i, /prereq/i,
  /launcher/i, /UE4/i, /UE5/i, /EasyAntiCheat/i, /BEService/i,
  /vcredist/i, /PhysX/i, /cef/i, /steam_api/i,
]

const AUTO_SCAN_SUBPATHS = [
  'Games',
  'Game',
  'GOG Games',
  'Epic Games',
  'XboxGames',
  'SteamLibrary/steamapps/common',
  'SteamLibrary',
  'Ubisoft/Ubisoft Game Launcher/games',
]

const STEAM_ROOT_CANDIDATES = [
  ['Program Files (x86)', 'Steam'],
  ['Program Files', 'Steam'],
  ['Steam'],
  ['Games', 'Steam'],
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

function prettifyFolderGameName(rawName) {
  return String(rawName || '')
    .replace(/\s*[\(\[]\d{4}[\)\]]/g, '')
    .replace(/[_\-.]+/g, ' ')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
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

function listWindowsDriveRoots() {
  try {
    const script = 'Get-PSDrive -PSProvider FileSystem | ForEach-Object { $_.Root }'
    const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', script], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 6000,
    })

    if (result.error) throw result.error
    const lines = String(result.stdout || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    const roots = lines
      .filter((line) => /^[a-zA-Z]:\\$/.test(line))
      .map((line) => line[0].toUpperCase() + ':\\')

    if (roots.length) {
      return Array.from(new Set(roots))
    }
  } catch {}

  return ['C:\\']
}

function listDriveRoots() {
  if (process.platform === 'win32') return listWindowsDriveRoots()
  return ['/']
}

function isDirectorySafe(dirPath) {
  try {
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()
  } catch {
    return false
  }
}

function parseSteamLibraryVdf(vdfPath) {
  try {
    if (!fs.existsSync(vdfPath)) return []
    const content = fs.readFileSync(vdfPath, 'utf8')
    const matches = [...content.matchAll(/"path"\s+"([^"]+)"/g)]
    const libs = matches
      .map((m) => String(m[1] || '').replace(/\\\\/g, '\\').trim())
      .filter(Boolean)
    return Array.from(new Set(libs))
  } catch {
    return []
  }
}

function findSteamCommonFolders(driveRoots) {
  const steamCommonFolders = []

  for (const root of driveRoots) {
    for (const parts of STEAM_ROOT_CANDIDATES) {
      const steamRoot = path.join(root, ...parts)
      if (!isDirectorySafe(steamRoot)) continue

      const defaultCommon = path.join(steamRoot, 'steamapps', 'common')
      if (isDirectorySafe(defaultCommon)) {
        steamCommonFolders.push(defaultCommon)
      }

      const libraryVdf = path.join(steamRoot, 'steamapps', 'libraryfolders.vdf')
      const libraries = parseSteamLibraryVdf(libraryVdf)
      for (const libPath of libraries) {
        const commonPath = path.join(libPath, 'steamapps', 'common')
        if (isDirectorySafe(commonPath)) {
          steamCommonFolders.push(commonPath)
        }
      }
    }
  }

  return Array.from(new Set(steamCommonFolders))
}

function findAutoScanFolders() {
  const driveRoots = listDriveRoots()
  const folders = []
  const steamCommonFolders = findSteamCommonFolders(driveRoots)

  for (const root of driveRoots) {
    for (const relativePath of AUTO_SCAN_SUBPATHS) {
      const candidate = path.join(root, ...relativePath.split('/'))
      try {
        if (!fs.existsSync(candidate)) continue
        const stat = fs.statSync(candidate)
        if (stat.isDirectory()) folders.push(candidate)
      } catch {}
    }
  }

  folders.push(...steamCommonFolders)

  return {
    driveRoots,
    folders: Array.from(new Set(folders)),
  }
}

function scanAutoGameFolders() {
  const { driveRoots, folders } = findAutoScanFolders()
  const dedupedByExe = new Map()

  for (const folder of folders) {
    const scanned = scanDir(folder)
    for (const game of scanned) {
      const key = String(game.exe || '').toLowerCase()
      if (!key || dedupedByExe.has(key)) continue
      dedupedByExe.set(key, game)
    }
  }

  return {
    games: Array.from(dedupedByExe.values()),
    scannedFolders: folders,
    driveRoots,
  }
}

function scanDir(dir) {
  const games = []
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const e of entries) {
      if (!e.isDirectory()) continue
      const gameFolder = path.join(dir, e.name)
      const gameName = prettifyFolderGameName(e.name)
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
  scanAutoGameFolders,
  calculateFolderSize,
}
