const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const { spawn } = require('child_process')
const { autoUpdater } = require('electron-updater')
const DiscordRPC = require('discord-rpc')

const { loadJSON, saveJSON } = require('./main/storage')
const { scanDir, scanAutoGameFolders, calculateFolderSize } = require('./main/scanner')
const { createProcessMonitor } = require('./main/processMonitor')
const { createSgdbService } = require('./main/sgdb')
const { createDownloader } = require('./main/downloader')
const { searchHltb } = require('./main/hltb')
const { searchPcgw } = require('./main/pcgamingwiki')

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

function resolveRuntimeEncryptionKey() {
  const envKey = String(process.env.VAPOR_ENCRYPTION_KEY || '').trim()
  if (envKey) return envKey

  const candidateFiles = app.isPackaged
    ? [path.join(process.resourcesPath, 'runtime-key.json')]
    : [path.join(__dirname, 'build', 'runtime-key.json')]

  for (const candidate of candidateFiles) {
    try {
      if (!fs.existsSync(candidate)) continue
      const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8'))
      const fileKey = String(parsed?.encryptionKey || '').trim()
      if (fileKey) return fileKey
    } catch {}
  }

  return 'vapor-default-key-change-me'
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

  const encryptionKey = resolveRuntimeEncryptionKey()
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
let currentGamePostScript = null
let currentGameWorkingDir = null
let discordRpcClient = null
let discordRpcReady = false
let discordRpcConnecting = false
const activeSessions = new Map()
let processMonitor = null

const DISCORD_CLIENT_ID = String(process.env.DISCORD_CLIENT_ID || '1485273656555864236').trim()
const DISCORD_ACTIVITY_STATE = 'Launched from Vapor'
const ENCRYPTION_KEY = resolveRuntimeEncryptionKey()

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
const customThemesDir = path.join(userDataPath, 'themes')
const downloadsDir = path.join(app.getPath('home'), 'Vapor Games')
const downloadsStateFile = path.join(userDataPath, 'downloads.json')

function ensureCustomThemesDir() {
  try {
    fs.mkdirSync(customThemesDir, { recursive: true })

    const readmePath = path.join(customThemesDir, 'README.txt')
    if (!fs.existsSync(readmePath)) {
      fs.writeFileSync(
        readmePath,
        [
          'Vapor Custom Themes',
          '',
          'Drop .css files into this folder.',
          'They appear in Settings > Themes under Custom Themes.',
          '',
          'Example selectors:',
          '  :root { --accent: #ff6a00; }',
          '  body { background: #101010 !important; }',
          "  :root[data-theme='custom:my-theme.css'] { --bg: #050505; }",
        ].join('\n'),
        'utf8'
      )
    }
  } catch (err) {
    console.error('[themes] Failed to initialize custom themes directory:', err)
  }
}

function themeIdFromFileName(fileName) {
  return `custom:${String(fileName || '').toLowerCase()}`
}

function listCustomThemes() {
  ensureCustomThemesDir()

  try {
    const entries = fs.readdirSync(customThemesDir, { withFileTypes: true })
    const themes = entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.css'))
      .map((entry) => {
        const fullPath = path.join(customThemesDir, entry.name)
        let css = ''
        try {
          css = fs.readFileSync(fullPath, 'utf8')
        } catch {
          css = ''
        }

        return {
          id: themeIdFromFileName(entry.name),
          fileName: entry.name,
          name: path.basename(entry.name, path.extname(entry.name)),
          css,
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))

    return { ok: true, folder: customThemesDir, themes }
  } catch (err) {
    console.error('[themes] Failed to list custom themes:', err)
    return { ok: false, folder: customThemesDir, themes: [], error: err.message }
  }
}

const sgdb = createSgdbService({
  ENCRYPTION_KEY,
  encryptedKeyFile: ENCRYPTED_KEY_FILE,
  sgdbKeyFile,
  allowRuntimeKeyOverride: !app.isPackaged,
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
    ensureCustomThemesDir()
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
    for (const [id] of activeSessions) {
      endTrackedSession(id, { countPlaytime: true })
    }
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
  const userSettings = loadJSON(settingsFile, defaultSettings)
  const isWin = process.platform === 'win32'
  const isWinUi3 = userSettings?.theme === 'winui3'
  const initialMaterial = isWin ? (isWinUi3 ? 'acrylic' : 'none') : undefined

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    frame: false,
    backgroundColor: '#00000000',
    backgroundMaterial: initialMaterial || 'acrylic',
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

  mainWindow.on('maximize', () => {
    sendToRenderer('win:maximize-change', true)
  })

  mainWindow.on('unmaximize', () => {
    sendToRenderer('win:maximize-change', false)
  })

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

function initProcessMonitor() {
  if (processMonitor) return
  processMonitor = createProcessMonitor({
    gamesFile,
    loadJSON,
    pollIntervalMs: 2500,
    onGameStarted: (game) => {
      console.log(`[processMonitor] Game started: "${game.name}" (${game.id})`)
      startTrackedSession(game, { external: true })
    },
    onGameStopped: (gameId) => {
      console.log(`[processMonitor] Game stopped: (${gameId})`)
      endTrackedSession(gameId)
    },
  })
}

function startRunningGamesMonitor() {
  initProcessMonitor()
  if (processMonitor) {
    processMonitor.start()
  }
}

function stopRunningGamesMonitor() {
  if (processMonitor) {
    processMonitor.stop()
  }
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
ipcMain.handle('win:isMaximized', () => (mainWindow ? mainWindow.isMaximized() : false))
ipcMain.handle('win:setBackgroundMaterial', (_, material) => {
  if (process.platform === 'win32' && mainWindow && typeof mainWindow.setBackgroundMaterial === 'function') {
    try {
      const valid = ['auto', 'none', 'mica', 'acrylic', 'tabbed']
      const mat = valid.includes(material) ? material : 'acrylic'
      mainWindow.setBackgroundMaterial(mat)
      return { ok: true, material: mat }
    } catch (err) {
      console.error('[win:setBackgroundMaterial] Error:', err)
      return { ok: false, error: err?.message }
    }
  }
  return { ok: false, error: 'Not supported on this platform' }
})
ipcMain.handle('win:isGameRunning', () => ({
  running: activeSessions.size > 0 || gameSessionStart !== null,
  gameId: currentGameId,
  startTime: gameSessionStart,
  runningIds: Array.from(activeSessions.keys()),
}))

ipcMain.handle('game:get-running', () => {
  const runningMap = {}
  for (const id of activeSessions.keys()) {
    runningMap[id] = true
  }
  if (processMonitor) {
    for (const id of processMonitor.getRunningGameIds()) {
      runningMap[id] = true
    }
  }
  return runningMap
})

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
    if (processMonitor) {
      processMonitor.refreshTrackedGames()
    }
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

ipcMain.handle('themes:list-custom', () => listCustomThemes())

ipcMain.handle('themes:open-custom-folder', async () => {
  ensureCustomThemesDir()
  try {
    const openError = await shell.openPath(customThemesDir)
    if (openError) return { ok: false, error: openError, folder: customThemesDir }
    return { ok: true, folder: customThemesDir }
  } catch (err) {
    return { ok: false, error: err.message, folder: customThemesDir }
  }
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

ipcMain.handle('hltb:search', async (_, name) => {
  try {
    return await searchHltb(name)
  } catch (err) {
    console.error('[hltb:search] Error:', err)
    return { ok: false, error: err.message, results: [] }
  }
})

ipcMain.handle('win:openExternal', async (_, url) => {
  if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
    shell.openExternal(url)
    return true
  }
  return false
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

function parseLaunchArgs(argsStr) {
  if (!argsStr || typeof argsStr !== 'string') return []
  const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g
  const args = []
  let match
  while ((match = regex.exec(argsStr)) !== null) {
    if (match[1] !== undefined) {
      args.push(match[1])
    } else if (match[2] !== undefined) {
      args.push(match[2])
    } else {
      args.push(match[0])
    }
  }
  return args
}

function parseEnvVars(envInput) {
  const result = {}
  if (!envInput) return result
  if (Array.isArray(envInput)) {
    for (const item of envInput) {
      if (item && item.key && String(item.key).trim()) {
        result[String(item.key).trim()] = String(item.value ?? '')
      }
    }
    return result
  }
  if (typeof envInput === 'object') {
    for (const [k, v] of Object.entries(envInput)) {
      if (k && k.trim()) result[k.trim()] = String(v ?? '')
    }
    return result
  }
  if (typeof envInput === 'string') {
    envInput.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx > 0) {
        result[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim()
      }
    })
  }
  return result
}

function resolveGameWorkingDir(game) {
  const customWd = String(game?.workingDir || '').trim()
  if (customWd && fs.existsSync(customWd)) return customWd
  const folder = String(game?.folder || '').trim()
  if (folder && fs.existsSync(folder)) return folder
  const exe = String(game?.exe || '').trim()
  if (exe) return path.dirname(exe)
  return process.cwd()
}

function runGameScript(scriptPathOrCmd, workingDir, options = { wait: true }) {
  return new Promise((resolve) => {
    if (!scriptPathOrCmd || typeof scriptPathOrCmd !== 'string') {
      return resolve({ ok: true, skipped: true })
    }
    const trimmed = scriptPathOrCmd.trim()
    if (!trimmed) return resolve({ ok: true, skipped: true })

    const cwd = workingDir && fs.existsSync(workingDir) ? workingDir : process.cwd()
    console.log(`[script] Running script: "${trimmed}" in "${cwd}" (wait: ${options.wait})`)

    let child
    try {
      if (process.platform === 'win32') {
        if (trimmed.toLowerCase().endsWith('.ps1')) {
          child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', trimmed], {
            cwd,
            windowsHide: true,
            stdio: 'ignore',
          })
        } else {
          child = spawn('cmd.exe', ['/c', trimmed], {
            cwd,
            windowsHide: true,
            stdio: 'ignore',
          })
        }
      } else {
        child = spawn('/bin/sh', ['-c', trimmed], {
          cwd,
          stdio: 'ignore',
        })
      }
    } catch (spawnErr) {
      console.error('[script] Spawn error:', spawnErr)
      return resolve({ ok: false, error: spawnErr.message })
    }

    if (!options.wait) {
      if (child && child.unref) child.unref()
      return resolve({ ok: true, detached: true })
    }

    let finished = false
    const done = (code, error) => {
      if (finished) return
      finished = true
      if (error) {
        console.error('[script] Execution error:', error)
        resolve({ ok: false, error: error.message })
      } else {
        console.log(`[script] Finished with code ${code}`)
        resolve({ ok: code === 0, code })
      }
    }

    child.once('error', (err) => done(null, err))
    child.once('close', (code) => done(code, null))

    setTimeout(() => {
      if (!finished) {
        console.warn('[script] Script execution timed out after 15s, continuing...')
        done(-1, new Error('Script timed out'))
      }
    }, 15000)
  })
}

function launchAsAdminWindows(game) {
  return new Promise((resolve, reject) => {
    const filePath = escapePowerShellSingleQuoted(game.exe)
    const workingDir = escapePowerShellSingleQuoted(resolveGameWorkingDir(game))
    const parsedArgs = parseLaunchArgs(game.launchArgs)
    const customEnv = parseEnvVars(game.envVars)

    let envSetup = ''
    for (const [k, v] of Object.entries(customEnv)) {
      envSetup += `$env:${k}='${escapePowerShellSingleQuoted(v)}'; `
    }

    let argParam = ''
    if (parsedArgs.length > 0) {
      const escapedArgs = parsedArgs.map((a) => `'${escapePowerShellSingleQuoted(a)}'`).join(',')
      argParam = ` -ArgumentList @(${escapedArgs})`
    }

    const command = `${envSetup}Start-Process -FilePath '${filePath}' -WorkingDirectory '${workingDir}'${argParam} -Verb RunAs`
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
    const workingDir = escapePowerShellSingleQuoted(resolveGameWorkingDir(game))
    const parsedArgs = parseLaunchArgs(game.launchArgs)
    const customEnv = parseEnvVars(game.envVars)

    let envSetup = "$env:__COMPAT_LAYER='RunAsInvoker'; "
    for (const [k, v] of Object.entries(customEnv)) {
      envSetup += `$env:${k}='${escapePowerShellSingleQuoted(v)}'; `
    }

    let argParam = ''
    if (parsedArgs.length > 0) {
      const escapedArgs = parsedArgs.map((a) => `'${escapePowerShellSingleQuoted(a)}'`).join(',')
      argParam = ` -ArgumentList @(${escapedArgs})`
    }

    const command = `${envSetup}Start-Process -FilePath '${filePath}' -WorkingDirectory '${workingDir}'${argParam}`
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

async function startTrackedSession(game, options = {}) {
  const gameId = typeof game === 'object' && game ? String(game.id) : String(game)
  const gameName = typeof game === 'object' && game ? game.name : null
  const gameArt = typeof game === 'object' && game ? game.art : null
  const external = options.external === true
  const startTime = options.startTime || Date.now()

  if (activeSessions.has(gameId)) {
    return activeSessions.get(gameId)
  }

  let sessionArt = gameArt?.grid || gameArt?.hero || gameArt?.logo || null
  const sessionData = {
    gameId,
    gameName: gameName || 'Game',
    gameArt: sessionArt,
    startTime,
    external,
    postScript: typeof game === 'object' && game?.postExitScript ? game.postExitScript : null,
    workingDir: typeof game === 'object' ? resolveGameWorkingDir(game) : null,
  }
  activeSessions.set(gameId, sessionData)

  gameSessionStart = startTime
  currentGameId = gameId
  currentGameName = gameName || null
  currentGameArt = sessionArt
  currentGamePostScript = sessionData.postScript
  currentGameWorkingDir = sessionData.workingDir

  if (DISCORD_CLIENT_ID && !sessionArt && gameName) {
    try {
      const key = sgdb.loadSgdbKey()
      if (key) {
        const sgdbGame = await sgdb.sgdbSearch(gameName)
        if (sgdbGame?.id) {
          const art = await sgdb.sgdbArt(sgdbGame.id)
          sessionArt = art.grid || art.hero || art.logo || null
          sessionData.gameArt = sessionArt
          if (currentGameId === gameId) {
            currentGameArt = sessionArt
            updateDiscordActivity(currentGameName)
          }
        }
      }
    } catch (err) {
      console.log('[discord-rpc] Could not fetch game art:', err?.message)
    }
  }

  if (currentGameId === gameId) {
    updateDiscordActivity(currentGameName)
  }

  sendToRenderer('game:running-started', { id: gameId, name: gameName, external })
  return sessionData
}

function endTrackedSession(gameId, options = {}) {
  const idStr = String(gameId)
  const sessionData = activeSessions.get(idStr)
  if (!sessionData && currentGameId !== idStr) {
    sendToRenderer('game:running-stopped', { id: idStr })
    return 0
  }

  const countPlaytime = options.countPlaytime !== false
  const startedAt = sessionData?.startTime || (currentGameId === idStr && typeof gameSessionStart === 'number' ? gameSessionStart : null)
  const endedAt = Date.now()
  const durationMs = startedAt ? Math.max(0, endedAt - startedAt) : 0
  const minutes = startedAt ? Math.max(0, Math.round(durationMs / 60000)) : 0

  const session = (startedAt && durationMs >= 15000) ? {
    id: String(Date.now()),
    start: startedAt,
    end: endedAt,
    durationMinutes: Math.max(1, minutes),
  } : null

  const effectiveMinutes = session ? session.durationMinutes : minutes

  if (countPlaytime && effectiveMinutes > 0) {
    saveGamePlaytime(idStr, effectiveMinutes, session)
  }

  const postScriptToRun = sessionData?.postScript || currentGamePostScript
  const postScriptDir = sessionData?.workingDir || currentGameWorkingDir || process.cwd()
  if (postScriptToRun) {
    runGameScript(postScriptToRun, postScriptDir, { wait: false }).catch((err) => {
      console.error('[script] Post-exit script error:', err)
    })
  }

  const wasExternal = !!sessionData?.external
  activeSessions.delete(idStr)

  if (currentGameId === idStr) {
    if (activeSessions.size > 0) {
      const [nextId, nextSession] = activeSessions.entries().next().value
      currentGameId = nextId
      currentGameName = nextSession.gameName
      currentGameArt = nextSession.gameArt
      gameSessionStart = nextSession.startTime
      currentGamePostScript = nextSession.postScript
      currentGameWorkingDir = nextSession.workingDir
      updateDiscordActivity(currentGameName)
    } else {
      gameSessionStart = null
      currentGameId = null
      currentGameName = null
      currentGameArt = null
      currentGamePostScript = null
      currentGameWorkingDir = null
      clearDiscordActivity()
    }
  }

  if (!wasExternal && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show()
    mainWindow.focus()
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    sendToRenderer('game:session-end', { id: idStr, minutes: effectiveMinutes, session })
    sendToRenderer('game:running-stopped', { id: idStr })
  }

  return effectiveMinutes
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

ipcMain.handle('pcgw:search', async (_, params) => {
  try {
    const name = typeof params === 'string' ? params : params?.name
    return await searchPcgw(name)
  } catch (err) {
    console.error('[pcgw:search] Error:', err)
    return { ok: false, error: err?.message, found: false }
  }
})

ipcMain.handle('game:launch', async (_, game) => {
  if (game?.preLaunchScript) {
    const workingDir = resolveGameWorkingDir(game)
    const wait = game.preLaunchWait !== false
    try {
      await runGameScript(game.preLaunchScript, workingDir, { wait })
    } catch (scriptErr) {
      console.warn('[script] Pre-launch script error, continuing launch:', scriptErr)
    }
  }

  if (game.steamAppId) {
    const argsSuffix = game.launchArgs ? `//${encodeURIComponent(game.launchArgs)}/` : ''
    const steamUrl = `steam://run/${game.steamAppId}${argsSuffix}`

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
      const workingDir = resolveGameWorkingDir(game)
      const parsedArgs = parseLaunchArgs(game.launchArgs)
      const customEnv = parseEnvVars(game.envVars)

      const proc = spawn(game.exe, parsedArgs, {
        cwd: workingDir,
        detached: false,
        stdio: 'ignore',
        env: { ...process.env, ...customEnv, __COMPAT_LAYER: 'RunAsInvoker' },
      })
      startTrackedSession(game)
      minimizeMainWindowForLaunch()

      proc.once('close', () => {
        setTimeout(() => {
          if (processMonitor && processMonitor.isGameRunning(game.id)) {
            console.log(`[game:launch] Launcher process closed but game process is still active for ${game.name}. Keeping session alive.`)
            return
          }
          endTrackedSession(game.id)
        }, 1500)
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

const MAX_STORED_SESSIONS_PER_GAME = 1000

function saveGamePlaytime(gameId, minutes, session = null) {
  try {
    const games = loadJSON(gamesFile, [])
    const updated = games.map((g) => {
      if (g.id === gameId) {
        const nextSessions = Array.isArray(g.sessions) ? [...g.sessions] : []
        if (session) {
          nextSessions.unshift(session)
        }
        if (nextSessions.length > MAX_STORED_SESSIONS_PER_GAME) {
          nextSessions.length = MAX_STORED_SESSIONS_PER_GAME
        }
        return {
          ...g,
          playtime: (g.playtime || 0) + minutes,
          lastPlayed: Date.now(),
          sessions: nextSessions,
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
