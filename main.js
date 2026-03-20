const { app, BrowserWindow, ipcMain, dialog, net } = require('electron')
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
const autoUpdater = require('electron-updater').autoUpdater
const isDev = !app.isPackaged
let mainWindow

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
const defaultSettings = {
  folders: [],
  collections: [],
  ui: {
    sidebarSort: 'recent',
    showPlaytimeInSidebar: true,
    compactSidebar: false,
    confirmRemoveGame: true,
  },
}

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

const SGDB_KEY = '88e6cb228484ce0db1cfbf231d76b9cc'
const SGDB = 'https://www.steamgriddb.com/api/v2'
const AUTH = { Authorization: `Bearer ${SGDB_KEY}` }

async function sgdbSearch(name) {
  const q = encodeURIComponent(name)
  const body = await netFetch(`${SGDB}/search/autocomplete/${q}`, AUTH)
  const json = JSON.parse(body)
  return json.data?.[0] || null
}

async function sgdbArt(gameId) {
  const [gridsR, heroesR, logosR, iconsR] = await Promise.allSettled([
    netFetch(`${SGDB}/grids/game/${gameId}?dimensions=600x900`, AUTH),
    netFetch(`${SGDB}/heroes/game/${gameId}`, AUTH),
    netFetch(`${SGDB}/logos/game/${gameId}`, AUTH),
    netFetch(`${SGDB}/icons/game/${gameId}`, AUTH),
  ])
  const pick = r => { try { return JSON.parse(r.value).data?.[0]?.url || null } catch { return null } }
  return {
    grid:   gridsR.status  === 'fulfilled' ? pick(gridsR)  : null,
    hero:   heroesR.status === 'fulfilled' ? pick(heroesR) : null,
    logo:   logosR.status  === 'fulfilled' ? pick(logosR)  : null,
    icon:   iconsR.status  === 'fulfilled' ? pick(iconsR)  : null,
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

app.whenReady().then(() => {
  configureAutoStart()
  createWindow()
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

ipcMain.handle("check-app-update", async () => {
  // if (!app.isPackaged) {
  //   return {
  //     success: false,
  //     skipped: true,
  //     hasUpdate: false,
  //     version: null,
  //     message: "Update checks are only available in packaged builds.",
  //   };
  // }

  try {
    console.debug("[auto-updater][manual] check requested");
    const result = await appAutoUpdater.runManualUpdateCheck(app.getVersion());

    if (!result.success) {
      return {
        success: false,
        skipped: false,
        hasUpdate: false,
        version: null,
        message: result.message || "Failed to check for updates.",
      };
    }

    return {
      success: true,
      hasUpdate: result.hasUpdate,
      version: result.version,
      message: result.hasUpdate
        ? `Update available${result.version ? `: ${result.version}` : ""}`
        : "No updates available.",
    };
  } catch (error) {
    console.error("[auto-updater][manual] check failed", error);

    return {
      success: false,
      skipped: false,
      hasUpdate: false,
      version: null,
      message: error instanceof Error ? error.message : "Failed to check for updates.",
    };
  }
});