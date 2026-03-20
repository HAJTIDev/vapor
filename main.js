const { app, BrowserWindow, ipcMain, dialog, net, safeStorage } = require('electron')
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
const crypto = require('crypto')
const { autoUpdater } = require('electron-updater')
const isDev = !app.isPackaged
let mainWindow

const ENCRYPTION_KEY = 'vapor-default-key-change-me'
const ENCRYPTED_KEY_FILE = isDev 
  ? path.join(__dirname, 'build', 'sgdb.enc.json')
  : path.join(process.resourcesPath, 'sgdb.enc.json')

let sgdbKeyCache = null

function decryptApiKey(encrypted) {
  try {
    const { iv, data } = JSON.parse(encrypted)
    const key = Buffer.from(ENCRYPTION_KEY, 'utf8').slice(0, 32)
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'))
    let decrypted = decipher.update(data, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch {
    return null
  }
}

function loadSgdbKey() {
  if (sgdbKeyCache !== null) return sgdbKeyCache
  const envKey = process.env.SGDB_KEY
  if (envKey) {
    sgdbKeyCache = envKey
    return sgdbKeyCache
  }
  try {
    if (fs.existsSync(SGDB_KEY_FILE)) {
      sgdbKeyCache = fs.readFileSync(SGDB_KEY_FILE, 'utf8').trim()
    } else if (fs.existsSync(ENCRYPTED_KEY_FILE)) {
      const encrypted = fs.readFileSync(ENCRYPTED_KEY_FILE, 'utf8')
      sgdbKeyCache = decryptApiKey(encrypted) || ''
    } else {
      sgdbKeyCache = ''
    }
  } catch { sgdbKeyCache = '' }
  return sgdbKeyCache
}

function saveSgdbKey(key) {
  try {
    if (!key) {
      if (fs.existsSync(SGDB_KEY_FILE)) fs.unlinkSync(SGDB_KEY_FILE)
      sgdbKeyCache = ''
      resetSgdbModule()
      console.log('[saveSgdbKey] Key cleared')
      return true
    }
    sgdbKeyCache = key
    fs.writeFileSync(SGDB_KEY_FILE, key)
    resetSgdbModule()
    console.log('[saveSgdbKey] Key saved, length:', key.length)
    return true
  } catch (err) {
    console.error('[saveSgdbKey] Error:', err)
    return false
  }
}

function getSgdbKey() {
  return loadSgdbKey() || null
}

const defaultSettings = {
  folders: [],
  collections: [],
  ui: {
    sidebarSort: 'recent',
    showPlaytimeInSidebar: true,
    compactSidebar: false,
    confirmRemoveGame: true,
    autoUpdate: true,
  },
}

const resolveAppIcon = () => {
  const packagedIcon = path.join(process.resourcesPath, 'icon.png')
  const devIcon = path.join(__dirname, 'build', 'icon.png')
  if (app.isPackaged && fs.existsSync(packagedIcon)) return packagedIcon
  if (fs.existsSync(devIcon)) return devIcon
  return undefined
}

function configureAutoStart() {
  if (process.platform !== 'win32' || !app.isPackaged) return
  app.setLoginItemSettings({
    openAtLogin: true,
    path: process.execPath,
  })
}

const userDataPath = app.getPath('userData')
const gamesFile = path.join(userDataPath, 'games.json')
const settingsFile = path.join(userDataPath, 'settings.json')
const SGDB_KEY_FILE = path.join(userDataPath, 'sgdb.key')

function loadJSON(file, def) {
  try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')) } catch {}
  return def
}
function saveJSON(file, data) {
  const dir = path.dirname(file)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = file + '.tmp'
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2))
    fs.renameSync(tmp, file)
  } catch (err) {
    console.error('[saveJSON] Failed to save', file, err)
    try { fs.unlinkSync(tmp) } catch {}
    throw err
  }
}

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
  const exeBase = path.basename(candidate.exeName, '.exe')
  const exeTokens = nameTokens(exeBase)
  const gameTokens = nameTokens(gameName)
  const exeNorm = normalizeName(exeBase)
  const gameNorm = normalizeName(gameName)
  let score = 0

  // Prefer shallower executables by default.
  score += Math.max(0, 40 - candidate.depth * 8)

  // Strongly prefer exact game-name matches.
  if (exeNorm === gameNorm) score += 90

  // Reward partial token matches between folder name and executable name.
  const overlap = gameTokens.filter(t => exeTokens.includes(t)).length
  score += overlap * 18
  if (gameTokens.length) score += Math.round((overlap / gameTokens.length) * 20)

  // Penalize very generic executable names that are often wrappers.
  if (/^(start|play|run|game|client|launcher|bootstrap)$/i.test(exeBase)) score -= 35

  // Slightly penalize common helper wrappers but keep valid UE shipping names viable.
  if (/launcher|bootstrap|updater|patcher/i.test(exeBase)) score -= 20

  // Tiny bonus for executables directly in the game folder.
  const relativeExe = path.relative(gameFolder, candidate.exe)
  if (!relativeExe.includes(path.sep)) score += 6

  return score
}

// Collect all exes recursively within a game folder
function collectExes(dir, depth = 0) {
  if (depth > 4) return []
  const found = []
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const e of entries) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) found.push(...collectExes(full, depth + 1))
      else if (e.isFile() && e.name.toLowerCase().endsWith('.exe') && isGameExe(e.name))
        found.push({ exe: full, exeName: e.name, depth })
    }
  } catch {}
  return found
}

// Pick the best exe candidate using depth + game-name similarity scoring.
function pickBestExe(exes, gameName, gameFolder) {
  if (!exes.length) return null
  exes.sort((a, b) => {
    const scoreDiff = scoreExeCandidate(b, gameName, gameFolder) - scoreExeCandidate(a, gameName, gameFolder)
    if (scoreDiff !== 0) return scoreDiff
    return a.depth - b.depth || b.exeName.length - a.exeName.length
  })
  return exes[0]
}

// Scan: each immediate subfolder = one game, named after the folder
function scanDir(dir) {
  const games = []
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const e of entries) {
      if (!e.isDirectory()) continue
      const gameFolder = path.join(dir, e.name)
      const gameName = e.name
        .replace(/\s*[\(\[]\d{4}[\)\]]/g, '')   // strip (2019) / [2019]
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      const exes = collectExes(gameFolder)
      const best = pickBestExe(exes, gameName, gameFolder)
      if (best) games.push({ name: gameName, exe: best.exe, folder: gameFolder, exeName: best.exeName })
    }
  } catch {}
  return games
}

function netFetch(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = net.request({ url, method: 'GET' })
    Object.entries(headers).forEach(([k, v]) => req.setHeader(k, v))
    let body = ''
    req.on('response', res => {
      res.on('data', c => body += c)
      res.on('end', () => resolve(body))
    })
    req.on('error', reject)
    req.end()
  })
}


const SGDB_BASE = 'https://www.steamgriddb.com/api/v2'

function resetSgdbModule() {}

async function sgdbFetch(endpoint) {
  const key = loadSgdbKey()
  if (!key) {
    console.error('[sgdbFetch] No API key loaded')
    return null
  }
  try {
    const url = `${SGDB_BASE}${endpoint}`
    const body = await netFetch(url, {
      'Authorization': `Bearer ${key}`,
      'Accept': 'application/json'
    })
    if (!body || !body.trim().startsWith('{')) {
      console.error('[sgdbFetch] Non-JSON response:', body?.substring?.(0, 300))
      return null
    }
    return JSON.parse(body)
  } catch (err) {
    console.error('[sgdbFetch] Error:', err.message || err)
    return null
  }
}

async function sgdbSearch(name) {
  const key = loadSgdbKey()
  if (!key) {
    console.log('[sgdbSearch] No API key')
    return null
  }
  try {
    console.log('[sgdbSearch] Searching for:', name)
    const data = await sgdbFetch(`/search/autocomplete/${encodeURIComponent(name)}`)
    if (!data?.data?.length) return null
    const game = data.data[0]
    console.log('[sgdbSearch] Found:', game.name, 'ID:', game.id)
    return { id: game.id, name: game.name }
  } catch (err) {
    console.error('[sgdbSearch] Error:', err)
    return null
  }
}

async function sgdbArt(gameId) {
  try {
    console.log('[sgdbArt] Fetching art for game ID:', gameId)
    const [grids, heroes, logos] = await Promise.all([
      sgdbFetch(`/grids/game/${gameId}?dimensions=600x900`),
      sgdbFetch(`/heroes/game/${gameId}`),
      sgdbFetch(`/logos/game/${gameId}`),
    ])
    console.log('[sgdbArt] Got:', { grid: !!grids?.data?.[0], hero: !!heroes?.data?.[0], logo: !!logos?.data?.[0] })
    return {
      grid: grids?.data?.[0]?.url || null,
      hero: heroes?.data?.[0]?.url || null,
      logo: logos?.data?.[0]?.url || null,
    }
  } catch (err) {
    console.error('[sgdbArt] Error:', err)
    return { grid: null, hero: null, logo: null }
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 960, minHeight: 600,
    frame: false, backgroundColor: '#09090e',
    icon: resolveAppIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, webSecurity: false
    }
  })
  if (isDev) mainWindow.loadURL('http://localhost:5173')
  else mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'))
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    console.log('[auto-updater] checking for update...')
    sendUpdateStatus('checking')
  })

  autoUpdater.on('update-available', (info) => {
    console.log('[auto-updater] update available:', info.version)
    sendUpdateStatus('available', info.version)
  })

  autoUpdater.on('update-not-available', (info) => {
    console.log('[auto-updater] update not available')
    sendUpdateStatus('not-available')
  })

  autoUpdater.on('download-progress', (progress) => {
    sendUpdateStatus('downloading', null, progress.percent)
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[auto-updater] update downloaded:', info.version)
    sendUpdateStatus('downloaded', info.version)
  })

  autoUpdater.on('error', (err) => {
    console.error('[auto-updater] error:', err)
    sendUpdateStatus('error', null, null, err.message)
  })
}

function sendUpdateStatus(status, version = null, progress = null, error = null) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update:status', { status, version, progress, error })
  }
}

function checkForUpdates(autoDownload = true) {
  if (!app.isPackaged) {
    console.log('[auto-updater] skipping update check in dev mode')
    return
  }
  autoUpdater.autoDownload = autoDownload
  autoUpdater.checkForUpdates().catch(err => {
    console.error('[auto-updater] check failed:', err)
    sendUpdateStatus('error', null, null, err.message)
  })
}

app.whenReady().then(() => {
  configureAutoStart()
  createWindow()
  setupAutoUpdater()
  const settings = loadJSON(settingsFile, defaultSettings)
  if (settings.ui?.autoUpdate !== false) {
    setTimeout(() => checkForUpdates(false), 5000)
  }
})
app.on('window-all-closed', () => app.quit())

ipcMain.handle('win:minimize', () => mainWindow.minimize())
ipcMain.handle('win:maximize', () => mainWindow.isMaximized() ? mainWindow.restore() : mainWindow.maximize())
ipcMain.handle('win:close', () => app.quit())

ipcMain.handle('dialog:folder', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
  return r.canceled ? null : r.filePaths[0]
})

ipcMain.handle('folder:scan', async (_, folder) => {
  return scanDir(folder)
})

ipcMain.handle('games:load', () => {
  try {
    return loadJSON(gamesFile, [])
  } catch (err) {
    console.error('[games:load] Error:', err)
    return []
  }
})
ipcMain.handle('games:save', (_, games) => {
  try {
    if (!Array.isArray(games)) {
      console.error('[games:save] Invalid data:', typeof games)
      return false
    }
    saveJSON(gamesFile, games)
    return true
  } catch (err) {
    console.error('[games:save] Error:', err)
    return false
  }
})

ipcMain.handle('settings:load', () => {
  try {
    return loadJSON(settingsFile, defaultSettings)
  } catch (err) {
    console.error('[settings:load] Error:', err)
    return defaultSettings
  }
})
ipcMain.handle('settings:save', (_, s) => {
  try {
    saveJSON(settingsFile, s)
    return true
  } catch (err) {
    console.error('[settings:save] Error:', err)
    return false
  }
})
ipcMain.handle('settings:getSgdbKey', () => loadSgdbKey())
ipcMain.handle('settings:setSgdbKey', (_, key) => saveSgdbKey(key))

ipcMain.handle('art:fetch', async (_, name) => {
  const key = loadSgdbKey()
  if (!key) {
    console.log('[art:fetch] No SteamGridDB API key configured')
    return { error: 'no-api-key' }
  }
  try {
    const game = await sgdbSearch(name)
    if (!game) return { error: 'not-found' }
    const art = await sgdbArt(game.id)
    return { ...art, sgdbName: game.name }
  } catch (err) {
    console.error('[art:fetch] Error:', err)
    return { error: err.message }
  }
})

ipcMain.handle('game:launch', (_, game) => {
  try {
    const proc = spawn(game.exe, [], { cwd: game.folder, detached: false, stdio: 'ignore' })
    const startTime = Date.now()
    proc.on('close', () => {
      const minutes = Math.max(0, Math.round((Date.now() - startTime) / 60000))
      if (mainWindow && !mainWindow.isDestroyed())
        mainWindow.webContents.send('game:session-end', { id: game.id, minutes })
    })
    proc.on('error', err => {
      if (mainWindow && !mainWindow.isDestroyed())
        mainWindow.webContents.send('game:launch-error', { id: game.id, error: err.message })
    })
    return { ok: true, pid: proc.pid }
  } catch (err) { return { ok: false, error: err.message } }
})

ipcMain.handle('update:check', () => {
  checkForUpdates(false)
  return { success: true }
})

ipcMain.handle('update:download', () => {
  autoUpdater.downloadUpdate()
  return { success: true }
})

ipcMain.handle('update:install', () => {
  autoUpdater.quitAndInstall()
  return { success: true }
})