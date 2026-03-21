const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('vapor', {
  win: {
    minimize: () => ipcRenderer.invoke('win:minimize'),
    maximize: () => ipcRenderer.invoke('win:maximize'),
    close:    () => ipcRenderer.invoke('win:close'),
  },
  dialog: {
    folder: () => ipcRenderer.invoke('dialog:folder'),
    file: (options) => ipcRenderer.invoke('dialog:file', options),
  },
  folder: {
    scan: (dir) => ipcRenderer.invoke('folder:scan', dir),
  },
  games: {
    load: ()        => ipcRenderer.invoke('games:load'),
    save: (games)   => ipcRenderer.invoke('games:save', games),
  },
  settings: {
    load: ()        => ipcRenderer.invoke('settings:load'),
    save: (s)       => ipcRenderer.invoke('settings:save', s),
    getSgdbKey: ()  => ipcRenderer.invoke('settings:getSgdbKey'),
    setSgdbKey: (k) => ipcRenderer.invoke('settings:setSgdbKey', k),
    setAutoStart: (e) => ipcRenderer.invoke('settings:setAutoStart', e),
  },
  art: {
    fetch: (name) => ipcRenderer.invoke('art:fetch', name),
  },
  game: {
    launch: (game) => ipcRenderer.invoke('game:launch', game),
    openFolder: (game) => ipcRenderer.invoke('game:open-folder', game),
    showExecutable: (game) => ipcRenderer.invoke('game:show-executable', game),
    isRunning: () => ipcRenderer.invoke('win:isGameRunning'),
  },
  update: {
    check: ()    => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: ()  => ipcRenderer.invoke('update:install'),
  },
  downloader: {
    start: (payload) => ipcRenderer.invoke('downloader:start', payload),
    list: () => ipcRenderer.invoke('downloader:list'),
    getLimit: () => ipcRenderer.invoke('downloader:get-limit'),
    setLimit: (limitKbps) => ipcRenderer.invoke('downloader:set-limit', limitKbps),
    pause: (infoHash) => ipcRenderer.invoke('downloader:pause', infoHash),
    resume: (infoHash) => ipcRenderer.invoke('downloader:resume', infoHash),
    remove: (infoHash, options) => ipcRenderer.invoke('downloader:remove', infoHash, options),
    clearCompleted: (options) => ipcRenderer.invoke('downloader:clear-completed', options),
    openFolder: (infoHash) => ipcRenderer.invoke('downloader:open-folder', infoHash),
    launchSetup: (infoHash) => ipcRenderer.invoke('downloader:launch-setup', infoHash),
  },
  steamcmd: {
    status: () => ipcRenderer.invoke('steamcmd:status'),
    list: () => ipcRenderer.invoke('steamcmd:list'),
    download: (options) => ipcRenderer.invoke('steamcmd:download', options),
    cancel: (id) => ipcRenderer.invoke('steamcmd:cancel', id),
    remove: (id) => ipcRenderer.invoke('steamcmd:remove', id),
    openFolder: (id) => ipcRenderer.invoke('steamcmd:open-folder', id),
  },
  on: (channel, fn) => ipcRenderer.on(channel, (_, ...args) => fn(...args)),
  off: (channel, fn) => ipcRenderer.removeListener(channel, fn),
})
