const fs = require('fs')
const path = require('path')

function createDownloader({
  downloadsDir,
  downloadsStateFile,
  settingsFile,
  defaultSettings,
  loadJSON,
  saveJSON,
  sendToRenderer,
}) {
  let torrentClient = null
  let webTorrentCtor = null
  let downloadPulse = null
  let statePersistPulse = null
  const torrentDownloads = new Map()
  const pendingTorrentSources = new Set()

  function getPersistedDownloads() {
    const raw = loadJSON(downloadsStateFile, [])
    if (!Array.isArray(raw)) return []
    return raw.filter((item) => item && item.source).map((item) => ({
      source: String(item.source),
      savePath: item.savePath ? String(item.savePath) : downloadsDir,
      paused: !!item.paused,
      createdAt: Number(item.createdAt) || Date.now(),
    }))
  }

  function persistDownloadsState() {
    try {
      const serialized = Array.from(torrentDownloads.values())
        .filter((torrent) => !torrent?.done && !torrent?._vaporDetached)
        .map((torrent) => ({
          source: torrent._vaporSource || torrent.magnetURI,
          savePath: torrent._vaporSavePath || torrent.path || downloadsDir,
          paused: !!torrent.paused,
          createdAt: torrent._vaporCreatedAt || Date.now(),
        }))
        .filter((item) => item.source)
      saveJSON(downloadsStateFile, serialized)
    } catch (err) {
      console.error('[downloader] Failed to persist downloads state:', err)
    }
  }

  function normalizeDownloadSource(source) {
    return String(source || '').trim()
  }

  function normalizeDownloadLimitKbps(value) {
    const num = Number(value)
    if (!Number.isFinite(num) || num < 0) return null
    return Math.round(num)
  }

  function readDownloadLimitKbpsFromSettings() {
    const settings = loadJSON(settingsFile, defaultSettings)
    const normalized = normalizeDownloadLimitKbps(settings?.downloadSpeedLimitKbps)
    return normalized ?? 0
  }

  function toDownloadLimitBytesPerSecond(limitKbps) {
    const normalized = normalizeDownloadLimitKbps(limitKbps)
    if (normalized == null || normalized <= 0) return -1
    return normalized * 1024
  }

  function saveDownloadLimitKbps(limitKbps) {
    const normalized = normalizeDownloadLimitKbps(limitKbps)
    if (normalized == null) {
      return { ok: false, error: 'Invalid download speed limit.' }
    }
    const settings = loadJSON(settingsFile, defaultSettings)
    saveJSON(settingsFile, { ...settings, downloadSpeedLimitKbps: normalized })
    return { ok: true, limitKbps: normalized }
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
      torrentClient = new WebTorrentCtor({
        downloadLimit: toDownloadLimitBytesPerSecond(readDownloadLimitKbpsFromSettings()),
      })
    }
    if (!downloadPulse) {
      downloadPulse = setInterval(() => {
        for (const torrent of torrentDownloads.values()) {
          emitTorrentUpdate(torrent)
        }
      }, 1000)
    }
    if (!statePersistPulse) {
      statePersistPulse = setInterval(() => {
        persistDownloadsState()
      }, 5000)
    }
    return torrentClient
  }

  function torrentStatus(torrent) {
    if (torrent?._vaporDetached) return 'completed'
    if (torrent.done) return 'completed'
    if (torrent.paused) return 'paused'
    return 'downloading'
  }

  function createDetachedTorrentRecord(torrent) {
    const basePath = torrent.path || torrent._vaporSavePath || downloadsDir
    const files = Array.isArray(torrent.files)
      ? torrent.files.map((file) => ({ path: file.path, length: file.length }))
      : []
    const setupFile = files.find((file) => /(^|[\\/])setup\.exe$/i.test(String(file?.path || '')))
    const setupExePath = setupFile ? path.join(basePath, setupFile.path) : null

    return {
      infoHash: torrent.infoHash,
      name: torrent.name || torrent.infoHash,
      magnetURI: torrent.magnetURI,
      progress: 1,
      downloaded: torrent.length || torrent.downloaded || 0,
      length: torrent.length || torrent.downloaded || 0,
      downloadSpeed: 0,
      uploadSpeed: 0,
      numPeers: 0,
      timeRemaining: 0,
      path: basePath,
      files,
      setupExePath,
      done: true,
      paused: true,
      _vaporDetached: true,
      _vaporSource: torrent._vaporSource || torrent.magnetURI,
      _vaporSavePath: torrent._vaporSavePath || basePath,
      _vaporCreatedAt: torrent._vaporCreatedAt || Date.now(),
      _vaporError: torrent._vaporError || null,
    }
  }

  function stopTorrentCompletely(torrent, options = {}) {
    const preserveRecord = options?.preserveRecord !== false
    const persist = options?.persist !== false

    if (!torrent) {
      return Promise.resolve({ ok: false, error: 'Download not found' })
    }

    if (torrent._vaporDetached) {
      return Promise.resolve({ ok: true, alreadyStopped: true })
    }

    if (!torrentClient) {
      if (preserveRecord) torrentDownloads.set(torrent.infoHash, createDetachedTorrentRecord(torrent))
      if (persist) persistDownloadsState()
      return Promise.resolve({ ok: true, alreadyStopped: true })
    }

    const detachedRecord = preserveRecord ? createDetachedTorrentRecord(torrent) : null
    return new Promise((resolve) => {
      torrentClient.remove(torrent.infoHash, { destroyStore: false }, (err) => {
        if (err) {
          resolve({ ok: false, error: err?.message || 'Failed to stop download' })
          return
        }

        if (detachedRecord) {
          torrentDownloads.set(torrent.infoHash, detachedRecord)
          emitTorrentUpdate(detachedRecord)
        } else {
          torrentDownloads.delete(torrent.infoHash)
          sendToRenderer('downloader:removed', { infoHash: torrent.infoHash })
        }

        if (persist) persistDownloadsState()
        resolve({ ok: true })
      })
    })
  }

  function serializeTorrent(torrent) {
    const firstFile = torrent.files?.[0]
    const setupFile = Array.isArray(torrent.files)
      ? torrent.files.find((file) => /(^|[\\/])setup\.exe$/i.test(String(file?.path || '')))
      : null
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
      setupExePath: setupFile ? path.join(torrent.path || '', setupFile.path) : null,
      status: torrentStatus(torrent),
      createdAt: torrent._vaporCreatedAt || Date.now(),
      error: torrent._vaporError || null,
    }
  }

  function emitTorrentUpdate(torrent) {
    sendToRenderer('downloader:progress', serializeTorrent(torrent))
  }

  function registerTorrentListeners(torrent) {
    if (torrent._vaporListenersBound) return
    torrent._vaporListenersBound = true
    torrent._vaporCreatedAt = torrent._vaporCreatedAt || Date.now()
    torrent.on('download', () => emitTorrentUpdate(torrent))
    torrent.on('done', () => {
      emitTorrentUpdate(torrent)
      stopTorrentCompletely(torrent, { preserveRecord: true, persist: true }).catch((err) => {
        torrent._vaporError = err?.message || 'Failed to stop seeding'
        emitTorrentUpdate(torrent)
        persistDownloadsState()
      })
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
      .filter((file) => file?.path)
      .map((file) => path.resolve(path.join(basePath, file.path)))
      .filter((filePath) => isPathInside(basePath, filePath))

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
    if (!torrent) {
      return Promise.resolve({ ok: false, error: 'Download not found' })
    }

    const deleteData = options?.deleteData !== false
    const deleteSnapshot = deleteData ? getTorrentDeleteSnapshot(torrent) : null

    if (torrent._vaporDetached || !torrentClient) {
      if (deleteData) deleteTorrentFiles(deleteSnapshot)
      torrentDownloads.delete(torrent.infoHash)
      persistDownloadsState()
      sendToRenderer('downloader:removed', { infoHash: torrent.infoHash })
      return Promise.resolve({ ok: true })
    }

    return new Promise((resolve) => {
      torrentClient.remove(torrent.infoHash, { destroyStore: true }, (err) => {
        if (err) {
          resolve({ ok: false, error: err?.message || 'Failed to remove download' })
          return
        }
        if (deleteData) deleteTorrentFiles(deleteSnapshot)
        torrentDownloads.delete(torrent.infoHash)
        persistDownloadsState()
        sendToRenderer('downloader:removed', { infoHash: torrent.infoHash })
        resolve({ ok: true })
      })
    })
  }

  function registerIpc({ ipcMain, shell }) {
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
      const completed = Array.from(torrentDownloads.values()).filter((torrent) => torrent.done)
      if (!completed.length) return { ok: true, removed: 0 }

      const results = await Promise.all(completed.map((torrent) => removeTorrentWithOptions(torrent, options)))
      const failed = results.filter((result) => !result.ok)
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

    ipcMain.handle('downloader:launch-setup', async (_, infoHash) => {
      try {
        const torrent = torrentDownloads.get(infoHash)
        if (!torrent) return { ok: false, error: 'Download not found' }

        const setupFile = Array.isArray(torrent.files)
          ? torrent.files.find((file) => /(^|[\\/])setup\.exe$/i.test(String(file?.path || '')))
          : null
        if (!setupFile) return { ok: false, error: 'setup.exe not found in this download.' }
        const basePath = path.resolve(torrent.path || torrent._vaporSavePath || downloadsDir)
        const setupPath = path.resolve(path.join(basePath, setupFile.path))
        if (!isPathInside(basePath, setupPath)) {
          return { ok: false, error: 'Invalid setup.exe location.' }
        }
        if (!fs.existsSync(setupPath)) {
          return { ok: false, error: 'setup.exe is not downloaded yet.' }
        }

        const stopResult = await stopTorrentCompletely(torrent, { preserveRecord: true, persist: true })
        if (!stopResult.ok) {
          return { ok: false, error: stopResult.error || 'Failed to stop torrent before launch.' }
        }

        const launchError = await shell.openPath(setupPath)
        if (launchError) return { ok: false, error: launchError }
        return { ok: true }
      } catch (err) {
        return { ok: false, error: err?.message || 'Failed to launch setup.exe.' }
      }
    })

    ipcMain.handle('downloader:get-limit', () => {
      const limitKbps = readDownloadLimitKbpsFromSettings()
      return { ok: true, limitKbps }
    })

    ipcMain.handle('downloader:set-limit', async (_, limitKbps) => {
      const persisted = saveDownloadLimitKbps(limitKbps)
      if (!persisted.ok) return persisted

      if (torrentClient && typeof torrentClient.throttleDownload === 'function') {
        torrentClient.throttleDownload(toDownloadLimitBytesPerSecond(persisted.limitKbps))
      }

      return {
        ok: true,
        limitKbps: persisted.limitKbps,
        unlimited: persisted.limitKbps <= 0,
      }
    })
  }

  function cleanup() {
    persistDownloadsState()

    if (downloadPulse) {
      clearInterval(downloadPulse)
      downloadPulse = null
    }
    if (statePersistPulse) {
      clearInterval(statePersistPulse)
      statePersistPulse = null
    }
    if (torrentClient) {
      torrentClient.destroy(() => {})
      torrentClient = null
    }
  }

  return {
    registerIpc,
    restorePersistedDownloads,
    cleanup,
  }
}

module.exports = {
  createDownloader,
}
