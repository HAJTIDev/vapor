const { app, BrowserWindow, ipcMain, dialog, net, safeStorage, Tray, Menu, nativeImage, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
const crypto = require('crypto')
const { autoUpdater } = require('electron-updater')
const isDev = !app.isPackaged
let mainWindow
let tray = null
let gameSessionStart = null
let currentGameId = null
let torrentClient = null
let webTorrentCtor = null
let downloadPulse = null
const torrentDownloads = new Map()
const pendingTorrentSources = new Set()

const ENCRYPTION_KEY = 'vapor-default-key-change-me'
const ENCRYPTED_KEY_FILE = isDev 
  ? path.join(__dirname, 'build', 'sgdb.enc.json')
  : path.join(process.resourcesPath, 'sgdb.enc.json')

let sgdbKeyCache = null

const gotTheLock = isDev ? true : app.requestSingleInstanceLock()
console.log('[init] gotTheLock:', gotTheLock)

if (!gotTheLock && !isDev) {
  console.log('[init] No lock, quitting')
  app.quit()
} else if (gotTheLock) {
  console.log('[init] Got lock or dev mode, continuing')
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      if (!mainWindow.isVisible()) mainWindow.show()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    console.log('[init] app.whenReady fired')
    configureAutoStart()
    createWindow()
    createTray()
    setupAutoUpdater()
    const settings = loadJSON(settingsFile, defaultSettings)
    if (settings.ui?.autoUpdate !== false) {
      setTimeout(() => checkForUpdates(false), 5000)
    }
    restorePersistedDownloads()
  })

  app.on('window-all-closed', () => {
    console.log('[init] window-all-closed')
    if (!app.isQuitting) {
      return
    }
    app.quit()
  })

  app.on('before-quit', () => {
    app.isQuitting = true
    if (downloadPulse) {
      clearInterval(downloadPulse)
      downloadPulse = null
    }
    if (torrentClient) {
      torrentClient.destroy(() => {})
      torrentClient = null
    }
  })
}

function decryptApiKey(encrypted) {
  try {
    const { iv, data } = JSON.parse(encrypted)
    const keyHash = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest()
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyHash, Buffer.from(iv, 'hex'))
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
    autoStart: true,
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
  const settings = loadJSON(settingsFile, defaultSettings)
  app.setLoginItemSettings({
    openAtLogin: settings.ui?.autoStart !== false,
    path: process.execPath,
  })
}

const userDataPath = app.getPath('userData')
const gamesFile = path.join(userDataPath, 'games.json')
const settingsFile = path.join(userDataPath, 'settings.json')
const SGDB_KEY_FILE = path.join(userDataPath, 'sgdb.key')
const downloadsDir = path.join(app.getPath('home'), 'Vapor Games')
const downloadsStateFile = path.join(userDataPath, 'downloads.json')

function getPersistedDownloads() {
  const raw = loadJSON(downloadsStateFile, [])
  if (!Array.isArray(raw)) return []
  return raw.filter(item => item && item.source).map(item => ({
    source: String(item.source),
    savePath: item.savePath ? String(item.savePath) : downloadsDir,
    paused: !!item.paused,
    createdAt: Number(item.createdAt) || Date.now(),
  }))
}

function persistDownloadsState() {
  try {
    const serialized = Array.from(torrentDownloads.values()).map(torrent => ({
      source: torrent._vaporSource || torrent.magnetURI,
      savePath: torrent._vaporSavePath || torrent.path || downloadsDir,
      paused: !!torrent.paused,
      createdAt: torrent._vaporCreatedAt || Date.now(),
    })).filter(item => item.source)
    saveJSON(downloadsStateFile, serialized)
  } catch (err) {
    console.error('[downloader] Failed to persist downloads state:', err)
  }
}

function normalizeDownloadSource(source) {
  return String(source || '').trim()
}

function findTrackedTorrentBySource(source) {
  const key = normalizeDownloadSource(source)
  if (!key) return null
  for (const torrent of torrentDownloads.values()) {
    const torrentSource = normalizeDownloadSource(torrent._vaporSource || torrent.magnetURI)
    if (torrentSource === key) return torrent
  }
  return null
}

async function loadWebTorrentCtor() {
  if (webTorrentCtor) return webTorrentCtor
  const mod = await import('webtorrent')
  webTorrentCtor = mod?.default || mod
  return webTorrentCtor
}

async function ensureTorrentClient() {
  if (!torrentClient) {
    const WebTorrentCtor = await loadWebTorrentCtor()
    torrentClient = new WebTorrentCtor()
  }
  if (!downloadPulse) {
    downloadPulse = setInterval(() => {
      for (const torrent of torrentDownloads.values()) {
        emitTorrentUpdate(torrent)
      }
    }, 1000)
  }
  return torrentClient
}

function torrentStatus(torrent) {
  if (torrent.done) return 'completed'
  if (torrent.paused) return 'paused'
  return 'downloading'
}

function serializeTorrent(torrent) {
  const firstFile = torrent.files?.[0]
  return {
    infoHash: torrent.infoHash,
    name: torrent.name || torrent.infoHash,
    magnetURI: torrent.magnetURI,
    progress: Math.round((torrent.progress || 0) * 10000) / 100,
    downloaded: torrent.downloaded || 0,
    length: torrent.length || 0,
    downloadSpeed: torrent.downloadSpeed || 0,
    uploadSpeed: torrent.uploadSpeed || 0,
    numPeers: torrent.numPeers || 0,
    timeRemaining: Number.isFinite(torrent.timeRemaining) ? torrent.timeRemaining : null,
    savePath: torrent.path || null,
    firstFilePath: firstFile ? path.join(torrent.path || '', firstFile.path) : null,
    status: torrentStatus(torrent),
    createdAt: torrent._vaporCreatedAt || Date.now(),
    error: torrent._vaporError || null,
  }
}

function emitTorrentUpdate(torrent) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send('downloader:progress', serializeTorrent(torrent))
}

function registerTorrentListeners(torrent) {
  if (torrent._vaporListenersBound) return
  torrent._vaporListenersBound = true
  torrent._vaporCreatedAt = torrent._vaporCreatedAt || Date.now()
  torrent.on('download', () => emitTorrentUpdate(torrent))
  torrent.on('done', () => {
    emitTorrentUpdate(torrent)
    persistDownloadsState()
  })
  torrent.on('wire', () => emitTorrentUpdate(torrent))
  torrent.on('noPeers', () => emitTorrentUpdate(torrent))
  torrent.on('error', (err) => {
    torrent._vaporError = err?.message || 'Unknown download error'
    emitTorrentUpdate(torrent)
    persistDownloadsState()
  })
}

function trackTorrent(torrent, meta = {}) {
  if (meta.source) torrent._vaporSource = String(meta.source)
  if (meta.savePath) torrent._vaporSavePath = String(meta.savePath)
  if (meta.createdAt) torrent._vaporCreatedAt = Number(meta.createdAt) || Date.now()
  torrentDownloads.set(torrent.infoHash, torrent)
  registerTorrentListeners(torrent)
  persistDownloadsState()
}

async function restorePersistedDownloads() {
  const seen = new Set()
  const entries = getPersistedDownloads().filter((entry) => {
    const key = normalizeDownloadSource(entry.source)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
  if (!entries.length) return

  try {
    const client = await ensureTorrentClient()
    for (const entry of entries) {
      try {
        fs.mkdirSync(entry.savePath, { recursive: true })
        const existing = await client.get(entry.source)
        if (existing) {
          trackTorrent(existing, entry)
          if (entry.paused) pauseTorrent(existing)
          else resumeTorrent(existing)
          emitTorrentUpdate(existing)
          continue
        }

        const sourceKey = normalizeDownloadSource(entry.source)
        if (pendingTorrentSources.has(sourceKey)) continue
        pendingTorrentSources.add(sourceKey)

        client.add(entry.source, { path: entry.savePath }, (torrent) => {
          pendingTorrentSources.delete(sourceKey)
          trackTorrent(torrent, entry)
          if (entry.paused) pauseTorrent(torrent)
          emitTorrentUpdate(torrent)
        })
      } catch (err) {
        pendingTorrentSources.delete(normalizeDownloadSource(entry.source))
        console.error('[downloader] Failed to restore entry:', err?.message || err)
      }
    }
  } catch (err) {
    console.error('[downloader] Restore failed:', err?.message || err)
  }
}

function pauseTorrent(torrent) {
  if (typeof torrent.pause === 'function') {
    torrent.pause()
    return
  }
  torrent.paused = true
}

function resumeTorrent(torrent) {
  if (typeof torrent.resume === 'function') {
    torrent.resume()
    return
  }
  torrent.paused = false
}

function isPathInside(basePath, candidatePath) {
  const rel = path.relative(path.resolve(basePath), path.resolve(candidatePath))
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

function removeEmptyParents(startPath, stopPath) {
  let current = path.dirname(startPath)
  const normalizedStop = path.resolve(stopPath)
  while (isPathInside(normalizedStop, current) && current !== normalizedStop) {
    try {
      if (fs.readdirSync(current).length > 0) break
      fs.rmdirSync(current)
    } catch {
      break
    }
    current = path.dirname(current)
  }
}

function getTorrentDeleteSnapshot(torrent) {
  const basePath = path.resolve(torrent?._vaporSavePath || torrent?.path || downloadsDir)
  const files = Array.isArray(torrent?.files) ? torrent.files : []
  const filePaths = files
    .filter(file => file?.path)
    .map(file => path.resolve(path.join(basePath, file.path)))
    .filter(filePath => isPathInside(basePath, filePath))

  if (!filePaths.length && torrent?.name) {
    const fallbackPath = path.resolve(path.join(basePath, torrent.name))
    if (isPathInside(basePath, fallbackPath)) filePaths.push(fallbackPath)
  }

  return { basePath, filePaths }
}

function deleteTorrentFiles(snapshot) {
  if (!snapshot?.basePath || !Array.isArray(snapshot.filePaths)) return
  const basePath = path.resolve(snapshot.basePath)
  for (const absolutePath of snapshot.filePaths) {
    if (!isPathInside(basePath, absolutePath)) continue
    try {
      fs.rmSync(absolutePath, { recursive: true, force: true })
      removeEmptyParents(absolutePath, basePath)
    } catch (err) {
      console.error('[downloader] Failed to delete file:', absolutePath, err?.message || err)
    }
  }
}

function removeTorrentWithOptions(torrent, options = {}) {
  if (!torrent || !torrentClient) {
    return Promise.resolve({ ok: false, error: 'Download not found' })
  }

  const deleteData = options?.deleteData !== false
  const deleteSnapshot = deleteData ? getTorrentDeleteSnapshot(torrent) : null

  return new Promise((resolve) => {
    torrentClient.remove(torrent.infoHash, { destroyStore: true }, (err) => {
      if (err) {
        resolve({ ok: false, error: err?.message || 'Failed to remove download' })
        return
      }
      if (deleteData) deleteTorrentFiles(deleteSnapshot)
      torrentDownloads.delete(torrent.infoHash)
      persistDownloadsState()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('downloader:removed', { infoHash: torrent.infoHash })
      }
      resolve({ ok: true })
    })
  })
}

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
  
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })
}

function createTray() {
  const iconPath = isDev 
    ? path.join(__dirname, 'build', 'icon.png')
    : path.join(process.resourcesPath, 'icon.png')
  
  let trayIcon
  if (fs.existsSync(iconPath)) {
    trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  } else {
    trayIcon = nativeImage.createEmpty()
  }
  
  tray = new Tray(trayIcon)
  tray.setToolTip('Vapor - Game Launcher')
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Vapor',
      click: () => {
        mainWindow.show()
        mainWindow.focus()
      }
    },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true
        app.quit()
      }
    }
  ])
  
  tray.setContextMenu(contextMenu)
  
  tray.on('double-click', () => {
    mainWindow.show()
    mainWindow.focus()
  })
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

ipcMain.handle('win:minimize', () => mainWindow.minimize())
ipcMain.handle('win:maximize', () => mainWindow.isMaximized() ? mainWindow.restore() : mainWindow.maximize())
ipcMain.handle('win:close', () => mainWindow.hide())
ipcMain.handle('win:isGameRunning', () => ({
  running: gameSessionStart !== null,
  gameId: currentGameId,
  startTime: gameSessionStart
}))

ipcMain.handle('dialog:folder', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
  return r.canceled ? null : r.filePaths[0]
})

ipcMain.handle('dialog:file', async (_, options = {}) => {
  const r = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: options.filters || [{ name: 'Executables', extensions: ['exe', 'bat', 'cmd', 'lnk'] }],
    defaultPath: options.defaultPath || undefined
  })
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
ipcMain.handle('settings:setAutoStart', (_, enabled) => {
  if (process.platform !== 'win32' || !app.isPackaged) return
  app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath })
})

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
  if (game.steamAppId) {
    const steamUrl = `steam://run/${game.steamAppId}`
    try {
      shell.openExternal(steamUrl)
      gameSessionStart = Date.now()
      currentGameId = game.id
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.minimize()
        }
      }, 100)
      setTimeout(() => {
        const minutes = Math.max(0, Math.round((Date.now() - gameSessionStart) / 60000))
        if (minutes > 0) {
          saveGamePlaytime(game.id, minutes)
        }
        gameSessionStart = null
        currentGameId = null
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show()
          mainWindow.focus()
          mainWindow.webContents.send('game:session-end', { id: game.id, minutes })
        }
      }, 5000)
      return { ok: true, via: 'steam' }
    } catch (err) { return { ok: false, error: err.message } }
  }

  try {
    const proc = spawn(game.exe, [], { cwd: game.folder, detached: false, stdio: 'ignore' })
    gameSessionStart = Date.now()
    currentGameId = game.id
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.minimize()
      }
    }, 100)
    proc.on('close', () => {
      const minutes = Math.max(0, Math.round((Date.now() - gameSessionStart) / 60000))
      if (minutes > 0) {
        saveGamePlaytime(game.id, minutes)
      }
      gameSessionStart = null
      currentGameId = null
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show()
        mainWindow.focus()
        mainWindow.webContents.send('game:session-end', { id: game.id, minutes })
      }
    })
    proc.on('error', err => {
      gameSessionStart = null
      currentGameId = null
      if (mainWindow && !mainWindow.isDestroyed())
        mainWindow.webContents.send('game:launch-error', { id: game.id, error: err.message })
    })
    return { ok: true, pid: proc.pid }
  } catch (err) { return { ok: false, error: err.message } }
})

function saveGamePlaytime(gameId, minutes) {
  try {
    const games = loadJSON(gamesFile, [])
    const updated = games.map(g => {
      if (g.id === gameId) {
        return {
          ...g,
          playtime: (g.playtime || 0) + minutes,
          lastPlayed: Date.now()
        }
      }
      return g
    })
    saveJSON(gamesFile, updated)
    console.log(`[playtime] Saved ${minutes} minutes for game ${gameId}`)
  } catch (err) {
    console.error('[playtime] Error saving playtime:', err)
  }
}

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

ipcMain.handle('downloader:start', async (_, payload = {}) => {
  const source = normalizeDownloadSource(payload.source)
  const settings = loadJSON(settingsFile, defaultSettings)
  const defaultDir = settings.downloadDir || downloadsDir
  const targetPath = String(payload.savePath || '').trim() || defaultDir
  if (!source) return { ok: false, error: 'Missing source' }

  const sourceKey = normalizeDownloadSource(source)
  if (pendingTorrentSources.has(sourceKey)) {
    return { ok: false, error: 'This download is already being started.' }
  }

  const tracked = findTrackedTorrentBySource(sourceKey)
  if (tracked) {
    resumeTorrent(tracked)
    emitTorrentUpdate(tracked)
    persistDownloadsState()
    return { ok: true, torrent: serializeTorrent(tracked), existing: true }
  }

  try {
    fs.mkdirSync(targetPath, { recursive: true })
    const client = await ensureTorrentClient()
    const torrent = await client.get(source)

    if (torrent) {
      if (!torrentDownloads.has(torrent.infoHash)) {
        trackTorrent(torrent, { source, savePath: targetPath })
      }
      resumeTorrent(torrent)
      emitTorrentUpdate(torrent)
      persistDownloadsState()
      return { ok: true, torrent: serializeTorrent(torrent), existing: true }
    }

    return await new Promise((resolve) => {
      let resolved = false
      pendingTorrentSources.add(sourceKey)
      client.add(source, { path: targetPath }, (addedTorrent) => {
        pendingTorrentSources.delete(sourceKey)
        trackTorrent(addedTorrent, { source, savePath: targetPath })
        addedTorrent.once('error', (err) => {
          addedTorrent._vaporError = err?.message || 'Failed to add torrent'
          emitTorrentUpdate(addedTorrent)
        })
        emitTorrentUpdate(addedTorrent)
        resolved = true
        resolve({ ok: true, torrent: serializeTorrent(addedTorrent), existing: false })
      })
      setTimeout(() => {
        if (!resolved) {
          pendingTorrentSources.delete(sourceKey)
          resolve({ ok: false, error: 'Timed out while starting download' })
        }
      }, 15000)
    })
  } catch (err) {
    pendingTorrentSources.delete(sourceKey)
    return { ok: false, error: err?.message || 'Failed to start download' }
  }
})

ipcMain.handle('downloader:list', () => {
  return Array.from(torrentDownloads.values())
    .map(serializeTorrent)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
})

ipcMain.handle('downloader:pause', (_, infoHash) => {
  const torrent = torrentDownloads.get(infoHash)
  if (!torrent) return { ok: false, error: 'Download not found' }
  pauseTorrent(torrent)
  emitTorrentUpdate(torrent)
  persistDownloadsState()
  return { ok: true }
})

ipcMain.handle('downloader:resume', (_, infoHash) => {
  const torrent = torrentDownloads.get(infoHash)
  if (!torrent) return { ok: false, error: 'Download not found' }
  resumeTorrent(torrent)
  emitTorrentUpdate(torrent)
  persistDownloadsState()
  return { ok: true }
})

ipcMain.handle('downloader:remove', async (_, infoHash, options = {}) => {
  const torrent = torrentDownloads.get(infoHash)
  return removeTorrentWithOptions(torrent, options)
})

ipcMain.handle('downloader:clear-completed', async (_, options = {}) => {
  const completed = Array.from(torrentDownloads.values()).filter(torrent => torrent.done)
  if (!completed.length) return { ok: true, removed: 0 }

  const results = await Promise.all(completed.map(torrent => removeTorrentWithOptions(torrent, options)))
  const failed = results.filter(result => !result.ok)
  return {
    ok: failed.length === 0,
    removed: completed.length - failed.length,
    failed: failed.length,
  }
})

ipcMain.handle('downloader:open-folder', (_, infoHash) => {
  const torrent = torrentDownloads.get(infoHash)
  if (!torrent) return { ok: false, error: 'Download not found' }
  const firstFile = torrent.files?.[0]
  if (firstFile) {
    shell.showItemInFolder(path.join(torrent.path || '', firstFile.path))
  } else if (torrent.path) {
    shell.openPath(torrent.path)
  }
  return { ok: true }
})