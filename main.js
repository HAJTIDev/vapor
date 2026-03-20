const { app, BrowserWindow, ipcMain, dialog, net, safeStorage } = require('electron')
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
const { autoUpdater } = require('electron-updater')
const isDev = !app.isPackaged
let mainWindow

const SGDB_KEY = process.env.SGDB_KEY || ''
const SGDB_KEY_ENC = safeStorage.isEncryptionAvailable() && SGDB_KEY
  ? safeStorage.encryptString(SGDB_KEY).toString('base64')
  : SGDB_KEY

function getSgdbKey() {
  if (!SGDB_KEY_ENC) return null
  if (safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(Buffer.from(SGDB_KEY_ENC, 'base64'))
    } catch { return SGDB_KEY_ENC }
  }
  return SGDB_KEY_ENC
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

function loadJSON(file, def) {
  try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')) } catch {}
  return def
}
function saveJSON(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)) }

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

const SGDB = 'https://www.steamgriddb.com/api/v2'

let sgdbModule = null

async function getSgdb() {
  if (!sgdbModule) {
    const key = getSgdbKey()
    if (!key) return null
    const { SteamGridDB } = await import('steamgriddb')
    sgdbModule = new SteamGridDB(key)
  }
  return sgdbModule
}

async function sgdbSearch(name) {
  const client = await getSgdb()
  if (!client) return null
  try {
    const results = await client.searchAutocomplete(name)
    return results[0] || null
  } catch { return null }
}

async function sgdbArt(gameId) {
  const client = await getSgdb()
  if (!client) return { grid: null, hero: null, logo: null, icon: null }
  try {
    const [grids, heroes, logos, icons] = await Promise.all([
      client.getGameGrids(gameId, { dimensions: '600x900' }),
      client.getGameHeroes(gameId),
      client.getGameLogos(gameId),
      client.getGameIcons(gameId),
    ])
    return {
      grid: grids[0]?.url || null,
      hero: heroes[0]?.url || null,
      logo: logos[0]?.url || null,
      icon: icons[0]?.url || null,
    }
  } catch { return { grid: null, hero: null, logo: null, icon: null } }
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

ipcMain.handle('games:load', () => loadJSON(gamesFile, []))
ipcMain.handle('games:save', (_, games) => { saveJSON(gamesFile, games); return true })

ipcMain.handle('settings:load', () => loadJSON(settingsFile, defaultSettings))
ipcMain.handle('settings:save', (_, s) => { saveJSON(settingsFile, s); return true })

ipcMain.handle('art:fetch', async (_, name) => {
  try {
    const game = await sgdbSearch(name)
    if (!game) return null
    const art = await sgdbArt(game.id)
    return { ...art, sgdbName: game.name }
  } catch { return null }
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