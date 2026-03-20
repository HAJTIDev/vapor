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
  },
  art: {
    fetch: (name) => ipcRenderer.invoke('art:fetch', name),
  },
  game: {
    launch: (game) => ipcRenderer.invoke('game:launch', game),
    isRunning: () => ipcRenderer.invoke('win:isGameRunning'),
  },
  update: {
    check: ()    => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: ()  => ipcRenderer.invoke('update:install'),
  },
  on: (channel, fn) => ipcRenderer.on(channel, (_, ...args) => fn(...args)),
  off: (channel, fn) => ipcRenderer.removeListener(channel, fn),
})
