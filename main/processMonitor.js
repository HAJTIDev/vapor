const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

// Process names that are too generic to match purely by filename without path confirmation
const GENERIC_EXE_NAMES = new Set([
  'game.exe',
  'launcher.exe',
  'gamelauncher.exe',
  'start.exe',
  'play.exe',
  'client.exe',
  'main.exe',
  'run.exe',
  'app.exe',
  'setup.exe',
  'installer.exe',
  'update.exe',
  'updater.exe',
  'patcher.exe',
  'bootstrap.exe',
])

// Common helper / utility exes to ignore when scanning game folders
const IGNORED_EXE_NAMES = new Set([
  'unins000.exe',
  'unins001.exe',
  'uninstall.exe',
  'crashreportclient.exe',
  'unitycrashhandler32.exe',
  'unitycrashhandler64.exe',
  'vcredist_x64.exe',
  'vcredist_x86.exe',
  'dxsetup.exe',
  'cmd.exe',
  'powershell.exe',
  'conhost.exe',
  'vapor.exe',
  'electron.exe',
  'ubisoftconnectinstaller.exe',
  'oalinst.exe',
  'dotnet.exe',
])

const SKIP_EXE_REGEXES = [
  /setup/i, /install/i, /unins/i, /crash/i, /report/i,
  /helper/i, /update/i, /patch/i, /vc_red/i, /dxsetup/i,
  /oalinst/i, /dotnet/i, /directx/i, /redist/i, /prereq/i,
]

function normalizePath(p) {
  if (!p) return ''
  return path.normalize(String(p)).toLowerCase()
}

function isGameExecutableCandidate(name) {
  const lower = String(name || '').toLowerCase()
  if (IGNORED_EXE_NAMES.has(lower)) return false
  return !SKIP_EXE_REGEXES.some((rx) => rx.test(lower))
}

function discoverGameFolderExes(folder, maxDepth = 2, curDepth = 0) {
  if (curDepth > maxDepth || !folder || !fs.existsSync(folder)) return []
  const candidates = []
  try {
    const entries = fs.readdirSync(folder, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(folder, entry.name)
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        candidates.push(...discoverGameFolderExes(full, maxDepth, curDepth + 1))
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.exe')) {
        if (isGameExecutableCandidate(entry.name)) {
          candidates.push(full)
        }
      }
    }
  } catch {}
  return candidates
}

function listRunningProcessNamesWindows() {
  return new Promise((resolve) => {
    const tasklist = spawn('tasklist.exe', ['/FO', 'CSV', '/NH'], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    })

    let stdout = ''
    tasklist.stdout.on('data', (chunk) => {
      stdout += String(chunk || '')
    })

    tasklist.once('error', () => resolve(new Set()))
    tasklist.once('close', () => {
      const names = new Set()
      const lines = stdout.split(/\r?\n/)
      for (const line of lines) {
        if (!line.trim()) continue
        // Format: "Image Name","PID","Session Name","Session#","Mem Usage"
        const match = line.match(/^"([^"]+)"/)
        if (match && match[1]) {
          names.add(match[1].toLowerCase())
        }
      }
      resolve(names)
    })
  })
}

function listRunningProcessPathsWindows() {
  return new Promise((resolve) => {
    const script = '(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue).ExecutablePath'
    const proc = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    })

    let output = ''
    proc.stdout.on('data', (chunk) => {
      output += String(chunk || '')
    })

    proc.once('error', () => resolve(new Set()))
    proc.once('close', () => {
      const lines = String(output || '')
        .split(/\r?\n/)
        .map((l) => normalizePath(l.trim()))
        .filter(Boolean)
      resolve(new Set(lines))
    })
  })
}

function createProcessMonitor({
  gamesFile,
  loadJSON,
  onGameStarted,
  onGameStopped,
  pollIntervalMs = 2500,
}) {
  let timer = null
  let isBusy = false
  let lastDetectedGameIds = new Set()
  let trackedGamesCache = []
  let trackedGamesTimestamp = 0
  let runningPathsCache = new Set()
  let runningPathsTimestamp = 0

  function refreshTrackedGames() {
    try {
      const games = loadJSON(gamesFile, [])
      if (!Array.isArray(games)) {
        trackedGamesCache = []
        return
      }

      trackedGamesCache = games
        .filter((g) => g && g.id != null && (g.exe || g.folder))
        .map((g) => {
          const normExe = normalizePath(g.exe)
          const normFolder = normalizePath(g.folder || (g.exe ? path.dirname(g.exe) : ''))
          const primaryExeName = normExe ? path.basename(normExe).toLowerCase() : ''
          const configuredExeName = g.exeName ? String(g.exeName).toLowerCase() : ''

          const candidateExeNames = new Set()
          if (primaryExeName) candidateExeNames.add(primaryExeName)
          if (configuredExeName) candidateExeNames.add(configuredExeName)

          // Discover any secondary game executables in the game folder
          if (g.folder && fs.existsSync(g.folder)) {
            const folderExes = discoverGameFolderExes(g.folder, 2)
            for (const fExe of folderExes) {
              const base = path.basename(fExe).toLowerCase()
              if (base && !IGNORED_EXE_NAMES.has(base)) {
                candidateExeNames.add(base)
              }
            }
          }

          return {
            id: String(g.id),
            rawGame: g,
            name: g.name || 'Game',
            normExe,
            normFolder,
            primaryExeName,
            candidateExeNames,
            isGenericName: GENERIC_EXE_NAMES.has(primaryExeName),
          }
        })

      trackedGamesTimestamp = Date.now()
    } catch (err) {
      console.error('[processMonitor] Failed to refresh tracked games:', err)
      trackedGamesCache = []
    }
  }

  async function detectRunningGameIds() {
    if (process.platform !== 'win32') return new Set()

    // Refresh game cache if empty or every 30 seconds
    if (!trackedGamesCache.length || Date.now() - trackedGamesTimestamp > 30000) {
      refreshTrackedGames()
    }
    if (!trackedGamesCache.length) return new Set()

    const runningNames = await listRunningProcessNamesWindows()
    if (!runningNames.size) return new Set()

    // Determine if we have any candidate games that need path checking (e.g. generic names)
    let needsPathCheck = false
    for (const game of trackedGamesCache) {
      if (game.isGenericName && runningNames.has(game.primaryExeName)) {
        needsPathCheck = true
        break
      }
    }

    // Refresh path cache if needed or every 20 seconds
    if (needsPathCheck || Date.now() - runningPathsTimestamp > 20000) {
      runningPathsCache = await listRunningProcessPathsWindows()
      runningPathsTimestamp = Date.now()
    }

    const detected = new Set()

    for (const game of trackedGamesCache) {
      let isRunning = false

      // 1. Exact full path match
      if (game.normExe && runningPathsCache.has(game.normExe)) {
        isRunning = true
      }

      // 2. Full path inside game folder
      if (!isRunning && game.normFolder && runningPathsCache.size > 0) {
        for (const p of runningPathsCache) {
          if (p.startsWith(game.normFolder)) {
            const base = path.basename(p).toLowerCase()
            if (!IGNORED_EXE_NAMES.has(base) && !SKIP_EXE_REGEXES.some((rx) => rx.test(base))) {
              isRunning = true
              break
            }
          }
        }
      }

      // 3. Primary and candidate executable name matching
      if (!isRunning) {
        for (const exeName of game.candidateExeNames) {
          if (runningNames.has(exeName)) {
            if (!GENERIC_EXE_NAMES.has(exeName)) {
              // High-confidence match (non-generic executable name like ACBlackFlag.exe, TheForest32.exe, etc.)
              isRunning = true
              break
            } else if (game.normExe && runningPathsCache.has(game.normExe)) {
              isRunning = true
              break
            }
          }
        }
      }

      if (isRunning) {
        detected.add(game.id)
      }
    }

    return detected
  }

  async function tick() {
    if (isBusy) return
    isBusy = true

    try {
      const currentDetected = await detectRunningGameIds()

      // Detect started games
      for (const id of currentDetected) {
        if (!lastDetectedGameIds.has(id)) {
          const matched = trackedGamesCache.find((g) => g.id === id)
          if (matched && typeof onGameStarted === 'function') {
            try {
              onGameStarted(matched.rawGame || { id, name: matched.name })
            } catch (err) {
              console.error(`[processMonitor] Error in onGameStarted for ${id}:`, err)
            }
          }
        }
      }

      // Detect stopped games
      for (const id of lastDetectedGameIds) {
        if (!currentDetected.has(id)) {
          if (typeof onGameStopped === 'function') {
            try {
              onGameStopped(id)
            } catch (err) {
              console.error(`[processMonitor] Error in onGameStopped for ${id}:`, err)
            }
          }
        }
      }

      lastDetectedGameIds = currentDetected
    } catch (err) {
      // Best-effort monitor
    } finally {
      isBusy = false
    }
  }

  function start() {
    if (timer) return
    refreshTrackedGames()
    tick()
    timer = setInterval(tick, pollIntervalMs)
  }

  function stop() {
    if (!timer) return
    clearInterval(timer)
    timer = null
    isBusy = false
    lastDetectedGameIds = new Set()
  }

  function isGameRunning(gameId) {
    return lastDetectedGameIds.has(String(gameId))
  }

  function getRunningGameIds() {
    return Array.from(lastDetectedGameIds)
  }

  return {
    start,
    stop,
    tick,
    isGameRunning,
    getRunningGameIds,
    refreshTrackedGames,
  }
}

module.exports = {
  createProcessMonitor,
  listRunningProcessNamesWindows,
  listRunningProcessPathsWindows,
  GENERIC_EXE_NAMES,
  IGNORED_EXE_NAMES,
}
