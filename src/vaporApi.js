const GAME_STORAGE_KEY = 'vapor.games'
const SETTINGS_STORAGE_KEY = 'vapor.settings'
const DEFAULT_SETTINGS = {
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
  },
}

function loadLocalJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function saveLocalJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore storage errors in fallback mode.
  }
}

const browserFallback = {
  win: {
    minimize: async () => {},
    maximize: async () => {},
    close: async () => {},
  },
  dialog: {
    folder: async () => null,
    file: async () => null,
  },
  folder: {
    scan: async () => [],
  },
  games: {
    load: async () => loadLocalJson(GAME_STORAGE_KEY, []),
    save: async (games) => {
      if (!Array.isArray(games)) {
        console.error('[browserFallback] Invalid games data:', typeof games)
        return false
      }
      saveLocalJson(GAME_STORAGE_KEY, games)
      return true
    },
  },
  settings: {
    load: async () => loadLocalJson(SETTINGS_STORAGE_KEY, DEFAULT_SETTINGS),
    save: async (settings) => {
      saveLocalJson(SETTINGS_STORAGE_KEY, settings)
      return true
    },
    getSgdbKey: async () => null,
    setSgdbKey: async () => false,
    setAutoStart: async () => false,
  },
  art: {
    fetch: async () => null,
  },
  game: {
    launch: async () => ({ ok: false, error: 'Game launching requires Electron runtime.' }),
    openFolder: async () => ({ ok: false, error: 'Opening folders requires Electron runtime.' }),
    showExecutable: async () => ({ ok: false, error: 'Revealing executables requires Electron runtime.' }),
  },
  update: {
    check: async () => ({ success: false }),
    download: async () => ({ success: false }),
    install: async () => ({ success: false }),
  },
  downloader: {
    start: async () => ({ ok: false, error: 'Downloader requires Electron runtime.' }),
    list: async () => [],
    getLimit: async () => ({ ok: true, limitKbps: 0 }),
    setLimit: async () => ({ ok: false, error: 'Downloader requires Electron runtime.' }),
    pause: async () => ({ ok: false, error: 'Downloader requires Electron runtime.' }),
    resume: async () => ({ ok: false, error: 'Downloader requires Electron runtime.' }),
    remove: async () => ({ ok: false, error: 'Downloader requires Electron runtime.' }),
    clearCompleted: async () => ({ ok: false, error: 'Downloader requires Electron runtime.' }),
    openFolder: async () => ({ ok: false, error: 'Downloader requires Electron runtime.' }),
    launchSetup: async () => ({ ok: false, error: 'Downloader requires Electron runtime.' }),
  },

  on: () => {},
  off: () => {},
}

const hasElectronBridge = typeof window !== 'undefined' && !!window.vapor

if (!hasElectronBridge && typeof window !== 'undefined') {
  console.warn('window.vapor is unavailable; running browser fallback API.')
}

const vaporApi = hasElectronBridge ? window.vapor : browserFallback

export default vaporApi
