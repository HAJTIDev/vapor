const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const { spawn } = require('child_process')
const { autoUpdater } = require('electron-updater')
const DiscordRPC = require('discord-rpc')

const { loadJSON, saveJSON } = require('./main/storage')
const { scanDir, scanAutoGameFolders, calculateFolderSize } = require('./main/scanner')
const { createSgdbService } = require('./main/sgdb')
const { createDownloader } = require('./main/downloader')

function parseEnvContent(content) {
  const env = {}
  String(content || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return

      const eqIndex = trimmed.indexOf('=')
      if (eqIndex <= 0) return

      const key = trimmed.slice(0, eqIndex).trim()
      let value = trimmed.slice(eqIndex + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      env[key] = value
    })
  return env
}

function applyEnvObject(envObject) {
  Object.entries(envObject || {}).forEach(([key, value]) => {
    if (process.env[key] == null || process.env[key] === '') {
      process.env[key] = String(value)
    }
  })
}

function decryptJsonPayload(encrypted, encryptionKey) {
  const parsed = JSON.parse(String(encrypted || '{}'))
  const keyHash = crypto.createHash('sha256').update(String(encryptionKey || '')).digest()
  const decipher = crypto.createDecipheriv('aes-256-cbc', keyHash, Buffer.from(parsed.iv, 'hex'))
  let decrypted = decipher.update(String(parsed.data || ''), 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return JSON.parse(decrypted)
}

function loadLocalEnv() {
  const envPath = path.join(__dirname, '.env')
  if (!fs.existsSync(envPath)) return

  try {
    const content = fs.readFileSync(envPath, 'utf8')
    applyEnvObject(parseEnvContent(content))
  } catch (err) {
    console.error('[env] Failed to read .env:', err)
  }
}

function loadEncryptedPackagedEnv() {
  const encryptedEnvPath = path.join(process.resourcesPath, 'env.enc.json')
  if (!fs.existsSync(encryptedEnvPath)) return

  const encryptionKey = process.env.VAPOR_ENCRYPTION_KEY || 'vapor-default-key-change-me'
  try {
    const encrypted = fs.readFileSync(encryptedEnvPath, 'utf8')
    const envObject = decryptJsonPayload(encrypted, encryptionKey)
    applyEnvObject(envObject)
  } catch (err) {
    console.error('[env] Failed to load encrypted env payload:', err)
  }
}

function loadRuntimeEnv() {
  if (app.isPackaged) {
    loadEncryptedPackagedEnv()
    return
  }
  loadLocalEnv()
}

loadRuntimeEnv()

const isDev = !app.isPackaged
let mainWindow
let tray = null
let gameSessionStart = null
let currentGameId = null
let currentGameName = null
let currentGameArt = null
let discordRpcClient = null
let discordRpcReady = false
let discordRpcConnecting = false
let runningGamesMonitorTimer = null
let runningGamesMonitorBusy = false
let lastDetectedRunningGameIds = new Set()

const DISCORD_CLIENT_ID = String(process.env.DISCORD_CLIENT_ID || '1485273656555864236').trim()
const DISCORD_ACTIVITY_STATE = 'Launched from Vapor'
const ENCRYPTION_KEY = process.env.VAPOR_ENCRYPTION_KEY || 'vapor-default-key-change-me'

const ENCRYPTED_KEY_FILE = isDev
  ? path.join(__dirname, 'build', 'sgdb.enc.json')
  : path.join(process.resourcesPath, 'sgdb.enc.json')

const defaultSettings = {
  folders: [],
  collections: [],
  downloadSpeedLimitKbps: 0,
  ui: {
    sidebarSort: 'recent',
    showPlaytimeInSidebar: true,
    compactSidebar: false,
    confirmRemoveGame: true,
    autoUpdate: true,
    autoStart: true,
    autoScanAllDrives: false,
    discordRpc: true,
  },
}

const userDataPath = app.getPath('userData')
const gamesFile = path.join(userDataPath, 'games.json')
const settingsFile = path.join(userDataPath, 'settings.json')
const sgdbKeyFile = path.join(userDataPath, 'sgdb.key')
const downloadsDir = path.join(app.getPath('home'), 'Vapor Games')
const downloadsStateFile = path.join(userDataPath, 'downloads.json')

const sgdb = createSgdbService({
  ENCRYPTION_KEY,
  encryptedKeyFile: ENCRYPTED_KEY_FILE,
  sgdbKeyFile,
})

const downloader = createDownloader({
  downloadsDir,
  downloadsStateFile,
  settingsFile,
  defaultSettings,
  loadJSON,
  saveJSON,
  sendToRenderer,
})

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
    initDiscordRpc()
    configureAutoStart()
    createWindow()
    startRunningGamesMonitor()
    createTray()
    setupAutoUpdater()
    const settings = loadJSON(settingsFile, defaultSettings)
    if (settings.ui?.autoUpdate !== false) {
      setTimeout(() => checkForUpdates(false), 5000)
    }
  })

  app.on('window-all-closed', () => {
    console.log('[init] window-all-closed')
    if (!app.isQuitting) return
    app.quit()
  })

  app.on('before-quit', () => {
    app.isQuitting = true
    stopRunningGamesMonitor()
    clearDiscordActivity()
    destroyDiscordRpc()
    downloader.cleanup()
  })
}

function resolveAppIcon() {
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    frame: false,
    backgroundColor: '#09090e',
    icon: resolveAppIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  })

  if (isDev) mainWindow.loadURL('http://localhost:5173')
  else mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'))

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })

  mainWindow.on('ready-to-show', () => {
    downloader.restorePersistedDownloads()
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
      },
    },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => {
    mainWindow.show()
    mainWindow.focus()
  })
}

function sendToRenderer(channel, ...args) {
  if (!mainWindow || mainWindow.isDestroyed()) return false
  const webContents = mainWindow.webContents
  if (!webContents || webContents.isDestroyed()) return false

  try {
    webContents.send(channel, ...args)
    return true
  } catch {
    return false
  }
}

function normalizeExePath(exePath) {
  if (!exePath) return ''
  return path.normalize(String(exePath)).toLowerCase()
}

function loadTrackedGamesWithExecutables() {
  try {
    const games = loadJSON(gamesFile, [])
    if (!Array.isArray(games)) return []
    return games
      .filter((game) => game && game.id != null && game.exe)
      .map((game) => ({ id: String(game.id), exe: normalizeExePath(game.exe) }))
      .filter((game) => !!game.exe)
  } catch {
    return []
  }
}

function listRunningExecutablePathsWindows() {
  return new Promise((resolve) => {
    const command = "$ErrorActionPreference='SilentlyContinue'; Get-Process | ForEach-Object { $_.Path } | Where-Object { $_ }"
    const checker = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    })

    let output = ''
    checker.stdout.on('data', (chunk) => {
      output += String(chunk || '')
    })

    checker.once('error', () => resolve(new Set()))
    checker.once('close', () => {
      const lines = String(output || '')
        .split(/\r?\n/)
        .map((line) => normalizeExePath(line.trim()))
        .filter(Boolean)

      resolve(new Set(lines))
    })
  })
}

async function detectRunningGameIds() {
  const trackedGames = loadTrackedGamesWithExecutables()
  if (!trackedGames.length) return new Set()
  if (process.platform !== 'win32') return new Set()

  const runningExePaths = await listRunningExecutablePathsWindows()
  const runningIds = new Set()

  for (const game of trackedGames) {
    if (runningExePaths.has(game.exe)) {
      runningIds.add(game.id)
    }
  }

  return runningIds
}

async function syncRunningGamesToRenderer() {
  if (runningGamesMonitorBusy) return
  runningGamesMonitorBusy = true

  try {
    const detectedRunning = await detectRunningGameIds()

    for (const id of detectedRunning) {
      if (!lastDetectedRunningGameIds.has(id)) {
        sendToRenderer('game:running-started', { id })
      }
    }

    for (const id of lastDetectedRunningGameIds) {
      if (!detectedRunning.has(id)) {
        sendToRenderer('game:running-stopped', { id })
      }
    }

    lastDetectedRunningGameIds = detectedRunning
  } catch {
    // Keep monitor best-effort to avoid interrupting the app on process query failures.
  } finally {
    runningGamesMonitorBusy = false
  }
}

function startRunningGamesMonitor() {
  if (runningGamesMonitorTimer) return
  syncRunningGamesToRenderer()
  runningGamesMonitorTimer = setInterval(syncRunningGamesToRenderer, 5000)
}

function stopRunningGamesMonitor() {
  if (!runningGamesMonitorTimer) return
  clearInterval(runningGamesMonitorTimer)
  runningGamesMonitorTimer = null
  runningGamesMonitorBusy = false
  lastDetectedRunningGameIds = new Set()
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

  autoUpdater.on('update-not-available', () => {
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
  sendToRenderer('update:status', { status, version, progress, error })
}

function checkForUpdates(autoDownload = true) {
  if (!app.isPackaged) {
    console.log('[auto-updater] skipping update check in dev mode')
    return
  }
  autoUpdater.autoDownload = autoDownload
  autoUpdater.checkForUpdates().catch((err) => {
    console.error('[auto-updater] check failed:', err)
    sendUpdateStatus('error', null, null, err.message)
  })
}

ipcMain.handle('win:minimize', () => mainWindow.minimize())
ipcMain.handle('win:maximize', () => (mainWindow.isMaximized() ? mainWindow.restore() : mainWindow.maximize()))
ipcMain.handle('win:close', () => mainWindow.hide())
ipcMain.handle('win:isGameRunning', () => ({
  running: gameSessionStart !== null,
  gameId: currentGameId,
  startTime: gameSessionStart,
}))

ipcMain.handle('dialog:folder', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
  return r.canceled ? null : r.filePaths[0]
})

ipcMain.handle('dialog:file', async (_, options = {}) => {
  const r = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: options.filters || [{ name: 'Executables', extensions: ['exe', 'bat', 'cmd', 'lnk'] }],
    defaultPath: options.defaultPath || undefined,
  })
  return r.canceled ? null : r.filePaths[0]
})

ipcMain.handle('folder:scan', async (_, folder) => scanDir(folder))
ipcMain.handle('folder:scan-all-drives', async () => scanAutoGameFolders())
ipcMain.handle('folder:getSize', async (_, folderPath) => calculateFolderSize(folderPath))

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

ipcMain.handle('settings:save', (_, settings) => {
  try {
    const previous = loadJSON(settingsFile, defaultSettings)
    saveJSON(settingsFile, settings)

    const wasDiscordEnabled = previous?.ui?.discordRpc !== false
    const isDiscordEnabled = settings?.ui?.discordRpc !== false

    if (!isDiscordEnabled) {
      clearDiscordActivity()
      destroyDiscordRpc()
    } else if (!wasDiscordEnabled || !discordRpcClient || !discordRpcReady) {
      initDiscordRpc()
      if (currentGameId) {
        updateDiscordActivity(currentGameName)
      }
    }

    return true
  } catch (err) {
    console.error('[settings:save] Error:', err)
    return false
  }
})

ipcMain.handle('settings:getSgdbKey', () => sgdb.loadSgdbKey())
ipcMain.handle('settings:setSgdbKey', (_, key) => sgdb.saveSgdbKey(key))

ipcMain.handle('settings:setAutoStart', (_, enabled) => {
  if (process.platform !== 'win32' || !app.isPackaged) return
  app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath })
})

ipcMain.handle('art:fetch', async (_, name) => {
  const key = sgdb.loadSgdbKey()
  if (!key) {
    console.log('[art:fetch] No SteamGridDB API key configured')
    return { error: 'no-api-key' }
  }
  try {
    const game = await sgdb.sgdbSearch(name)
    if (!game) return { error: 'not-found' }
    const art = await sgdb.sgdbArt(game.id)
    return { ...art, sgdbName: game.name }
  } catch (err) {
    console.error('[art:fetch] Error:', err)
    return { error: err.message }
  }
})

function escapePowerShellSingleQuoted(value) {
  return String(value || '').replace(/'/g, "''")
}

function isElevationLaunchError(err) {
  if (!err) return false
  const code = String(err.code || '').toUpperCase()
  if (code === 'EACCES' || code === 'EPERM' || code === 'UNKNOWN') return true
  const msg = String(err.message || '').toLowerCase()
  if (msg.includes('elevation') || msg.includes('operation not permitted')) return true
  return msg.includes('requires elevation')
}

function launchAsAdminWindows(game) {
  return new Promise((resolve, reject) => {
    const filePath = escapePowerShellSingleQuoted(game.exe)
    const workingDir = escapePowerShellSingleQuoted(game.folder || path.dirname(game.exe || ''))
    const command = `Start-Process -FilePath '${filePath}' -WorkingDirectory '${workingDir}' -Verb RunAs`
    const helper = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], {
      windowsHide: true,
      stdio: 'ignore',
    })
    helper.once('error', reject)
    helper.once('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(code === 1 ? 'Administrator launch was canceled.' : `Administrator launch failed (${code}).`))
    })
  })
}

function launchRunAsInvokerWindows(game) {
  return new Promise((resolve, reject) => {
    const filePath = escapePowerShellSingleQuoted(game.exe)
    const workingDir = escapePowerShellSingleQuoted(game.folder || path.dirname(game.exe || ''))
    const command = `$env:__COMPAT_LAYER='RunAsInvoker'; Start-Process -FilePath '${filePath}' -WorkingDirectory '${workingDir}'`
    const helper = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], {
      windowsHide: true,
      stdio: 'ignore',
    })
    helper.once('error', reject)
    helper.once('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(code === 1 ? 'Game launch was canceled.' : `Non-admin launch failed (${code}).`))
    })
  })
}

function minimizeMainWindowForLaunch() {
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.minimize()
    }
  }, 100)
}

function initDiscordRpc() {
  const settings = loadJSON(settingsFile, defaultSettings)
  if (!DISCORD_CLIENT_ID || settings.ui?.discordRpc === false || discordRpcClient || discordRpcConnecting) return

  try {
    discordRpcConnecting = true
    DiscordRPC.register(DISCORD_CLIENT_ID)
    const client = new DiscordRPC.Client({ transport: 'ipc' })

    client.on('ready', () => {
      discordRpcReady = true
      discordRpcConnecting = false
      if (currentGameId) {
        updateDiscordActivity(currentGameName)
      }
    })

    client.on('disconnected', () => {
      discordRpcReady = false
      discordRpcConnecting = false
    })

    client.on('error', (err) => {
      console.error('[discord-rpc] Client error:', err?.message || err)
    })

    client.login({ clientId: DISCORD_CLIENT_ID }).then(() => {
      discordRpcClient = client
    }).catch((err) => {
      discordRpcConnecting = false
      console.error('[discord-rpc] Login failed:', err?.message || err)
    })
  } catch (err) {
    discordRpcConnecting = false
    console.error('[discord-rpc] Init failed:', err?.message || err)
  }
}

function destroyDiscordRpc() {
  if (!discordRpcClient) return
  const client = discordRpcClient
  discordRpcClient = null
  discordRpcReady = false
  discordRpcConnecting = false
  client.destroy().catch(() => {})
}

function updateDiscordActivity(gameName) {
  const settings = loadJSON(settingsFile, defaultSettings)
  if (!DISCORD_CLIENT_ID || settings.ui?.discordRpc === false) {
    clearDiscordActivity()
    return
  }
  initDiscordRpc()

  const detailsName = String(gameName || '').trim() || 'a game'
  if (!discordRpcClient || !discordRpcReady) return

  const buttons = [{ label: 'Download Vapor', url: 'https://github.com/HAJTIDev/vapor/releases' }]

  discordRpcClient.setActivity({
    details: `Playing ${detailsName}`,
    state: DISCORD_ACTIVITY_STATE,
    startTimestamp: gameSessionStart ? new Date(gameSessionStart) : undefined,
    instance: false,
    largeImageKey: currentGameArt || undefined,
    largeImageText: currentGameArt ? detailsName : undefined,
    smallImageKey: 'vaporicon',
    smallImageText: 'Vapor',
    buttons,
  }).catch((err) => {
    console.error('[discord-rpc] Failed to set activity:', err?.message || err)
  })
}

function clearDiscordActivity() {
  if (!discordRpcClient || !discordRpcReady) return
  discordRpcClient.clearActivity().catch(() => {})
}

async function startTrackedSession(game) {
  const gameId = typeof game === 'object' && game ? game.id : game
  const gameName = typeof game === 'object' && game ? game.name : null
  const gameArt = typeof game === 'object' && game ? game.art : null
  gameSessionStart = Date.now()
  currentGameId = gameId
  currentGameName = gameName || null
  currentGameArt = gameArt?.grid || gameArt?.hero || gameArt?.logo || null

  if (DISCORD_CLIENT_ID && !currentGameArt) {
    try {
      const key = sgdb.loadSgdbKey()
      if (key) {
        const sgdbGame = await sgdb.sgdbSearch(gameName)
        if (sgdbGame?.id) {
          const art = await sgdb.sgdbArt(sgdbGame.id)
          currentGameArt = art.grid || art.hero || art.logo || null
          if (currentGameId === gameId) {
            updateDiscordActivity(currentGameName)
          }
          return
        }
      }
    } catch (err) {
      console.log('[discord-rpc] Could not fetch game art:', err?.message)
    }
  }

  if (currentGameId === gameId) {
    updateDiscordActivity(currentGameName)
  }
}

function endTrackedSession(gameId, options = {}) {
  const countPlaytime = options.countPlaytime !== false
  const startedAt = currentGameId === gameId && typeof gameSessionStart === 'number'
    ? gameSessionStart
    : null
  const minutes = startedAt ? Math.max(0, Math.round((Date.now() - startedAt) / 60000)) : 0

  if (countPlaytime && minutes > 0) {
    saveGamePlaytime(gameId, minutes)
  }
  if (currentGameId === gameId) {
    gameSessionStart = null
    currentGameId = null
    currentGameName = null
    currentGameArt = null
    clearDiscordActivity()
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show()
    mainWindow.focus()
    sendToRenderer('game:session-end', { id: gameId, minutes })
  }
  return minutes
}

function isProcessRunningByNameWindows(processName) {
  return new Promise((resolve) => {
    const escaped = escapePowerShellSingleQuoted(processName)
    const command = `$p = Get-Process -Name '${escaped}' -ErrorAction SilentlyContinue; if ($p) { exit 0 } else { exit 1 }`
    const checker = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], {
      windowsHide: true,
      stdio: 'ignore',
    })
    checker.once('error', () => resolve(false))
    checker.once('close', (code) => resolve(code === 0))
  })
}

function monitorElevatedSession(game) {
  const processName = path.basename(String(game?.exe || ''), '.exe').trim()
  if (!processName) {
    endTrackedSession(game.id)
    return
  }

  let sawRunning = false
  let checks = 0
  const maxChecksBeforeGivingUp = 24

  const tick = async () => {
    if (currentGameId !== game.id) return

    const running = await isProcessRunningByNameWindows(processName)
    if (currentGameId !== game.id) return

    checks += 1
    if (running) {
      sawRunning = true
      setTimeout(tick, 5000)
      return
    }

    if (!sawRunning) {
      if (checks < maxChecksBeforeGivingUp) {
        setTimeout(tick, 1500)
        return
      }

      gameSessionStart = null
      currentGameId = null
      currentGameName = null
      currentGameArt = null
      clearDiscordActivity()
      sendToRenderer('game:launch-error', {
        id: game.id,
        error: 'Game did not start after elevation.',
      })
      return
    }

    endTrackedSession(game.id, { countPlaytime: !game?.runAsAdmin })
  }

  setTimeout(tick, 1500)
}

function monitorSteamGameSession(game) {
  const processName = path.basename(String(game?.exe || ''), '.exe').trim()

  if (!processName) {
    console.log('[steam] No exe path set for game, using basic 5-minute session')
    startTrackedSession(game)
    minimizeMainWindowForLaunch()
    setTimeout(() => {
      if (currentGameId === game.id) {
        endTrackedSession(game.id)
      }
    }, 5 * 60 * 1000)
    return
  }

  let gameProcessStarted = false
  let checks = 0
  const maxStartupChecks = 40

  const tick = async () => {
    if (currentGameId !== game.id) return

    const running = await isProcessRunningByNameWindows(processName)
    if (currentGameId !== game.id) return

    checks += 1

    if (running) {
      if (!gameProcessStarted) {
        console.log(`[steam] Game process "${processName}" started, tracking session`)
        gameProcessStarted = true
      }
      setTimeout(tick, 5000)
      return
    }

    if (!gameProcessStarted) {
      if (checks < maxStartupChecks) {
        setTimeout(tick, 1500)
        return
      }

      console.log(`[steam] Game process "${processName}" never started, ending session`)
      gameSessionStart = null
      currentGameId = null
      currentGameName = null
      currentGameArt = null
      clearDiscordActivity()
      sendToRenderer('game:launch-error', {
        id: game.id,
        error: 'Game did not start. Make sure Steam is running and the game is installed.',
      })
      return
    }

    console.log(`[steam] Game process "${processName}" exited, ending session`)
    endTrackedSession(game.id)
  }

  startTrackedSession(game)
  minimizeMainWindowForLaunch()
  setTimeout(tick, 1500)
}

async function isSteamRunningWindows() {
  return new Promise((resolve) => {
    const command = `$p = Get-Process -Name 'steam' -ErrorAction SilentlyContinue; if ($p) { exit 0 } else { exit 1 }`
    const checker = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], {
      windowsHide: true,
      stdio: 'ignore',
    })
    checker.once('error', () => resolve(false))
    checker.once('close', (code) => resolve(code === 0))
  })
}

ipcMain.handle('game:launch', async (_, game) => {
  if (game.steamAppId) {
    const steamUrl = `steam://run/${game.steamAppId}`

    if (process.platform === 'win32') {
      const steamRunning = await isSteamRunningWindows()
      if (!steamRunning) {
        const errorMsg = 'Steam is not running. Please start Steam first.'
        sendToRenderer('game:launch-error', { id: game.id, error: errorMsg })
        return { ok: false, error: errorMsg }
      }
    }

    try {
      shell.openExternal(steamUrl)
      monitorSteamGameSession(game)
      return { ok: true, via: 'steam', tracking: true }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }

  const runAsAdmin = process.platform === 'win32' && !!game?.runAsAdmin
  if (runAsAdmin) {
    try {
      await launchAsAdminWindows(game)
      startTrackedSession(game)
      minimizeMainWindowForLaunch()
      monitorElevatedSession(game)
      return { ok: true, via: 'admin', tracking: true, playtimeTracked: false }
    } catch (adminErr) {
      return { ok: false, error: adminErr?.message || 'Failed to launch as administrator.' }
    }
  }

  const launchNormally = () => new Promise((resolve) => {
    let finished = false
    const finishOnce = (result) => {
      if (finished) return
      finished = true
      resolve(result)
    }

    try {
      const proc = spawn(game.exe, [], {
        cwd: game.folder,
        detached: false,
        stdio: 'ignore',
        env: { ...process.env, __COMPAT_LAYER: 'RunAsInvoker' },
      })
      startTrackedSession(game)
      minimizeMainWindowForLaunch()

      proc.once('close', () => {
        endTrackedSession(game.id)
      })

      proc.once('error', (err) => {
        if (currentGameId === game.id) {
          gameSessionStart = null
          currentGameId = null
          currentGameName = null
          currentGameArt = null
          clearDiscordActivity()
        }
        finishOnce({ ok: false, error: err?.message || 'Failed to launch game.', code: err?.code || null })
      })

      proc.once('spawn', () => {
        finishOnce({ ok: true, pid: proc.pid, tracking: true })
      })
    } catch (err) {
      finishOnce({ ok: false, error: err?.message || 'Failed to launch game.', code: err?.code || null })
    }
  })

  const result = await launchNormally()
  if (result.ok) return result
  if (process.platform === 'win32' && isElevationLaunchError(result)) {
    return {
      ok: false,
      error: 'This game appears to require administrator rights. Enable Run as administrator in game settings.',
    }
  }
  if (process.platform !== 'win32') {
    return result
  }

  try {
    await launchRunAsInvokerWindows(game)
    startTrackedSession(game)
    minimizeMainWindowForLaunch()
    monitorElevatedSession(game)
    return { ok: true, via: 'runasinvoker', tracking: true }
  } catch (fallbackErr) {
    return { ok: false, error: fallbackErr?.message || result.error }
  }
})

function resolveGameFolder(game) {
  const folder = String(game?.folder || '').trim()
  if (folder) return folder
  const exe = String(game?.exe || '').trim()
  if (!exe) return null
  return path.dirname(exe)
}

ipcMain.handle('game:open-folder', async (_, game) => {
  try {
    const folder = resolveGameFolder(game)
    if (!folder) return { ok: false, error: 'No game folder found.' }
    if (!fs.existsSync(folder)) return { ok: false, error: 'Game folder does not exist.' }
    const openError = await shell.openPath(folder)
    if (openError) return { ok: false, error: openError }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err?.message || 'Failed to open game folder.' }
  }
})

ipcMain.handle('game:show-executable', (_, game) => {
  try {
    const exePath = String(game?.exe || '').trim()
    if (!exePath) return { ok: false, error: 'No executable path set.' }
    if (!fs.existsSync(exePath)) return { ok: false, error: 'Executable does not exist.' }
    shell.showItemInFolder(exePath)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err?.message || 'Failed to reveal executable.' }
  }
})

function saveGamePlaytime(gameId, minutes) {
  try {
    const games = loadJSON(gamesFile, [])
    const updated = games.map((g) => {
      if (g.id === gameId) {
        return {
          ...g,
          playtime: (g.playtime || 0) + minutes,
          lastPlayed: Date.now(),
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

downloader.registerIpc({ ipcMain, shell })
