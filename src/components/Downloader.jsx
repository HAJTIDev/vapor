import React, { useEffect, useMemo, useState } from 'react'
import vaporApi from '../vaporApi.js'

function humanBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let idx = 0
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024
    idx += 1
  }
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(digits)} ${units[idx]}`
}

function humanSpeed(bytesPerSecond) {
  return `${humanBytes(bytesPerSecond)}/s`
}

function humanEta(ms) {
  if (!ms || ms <= 0 || !Number.isFinite(ms)) return '--'
  const totalSeconds = Math.round(ms / 1000)
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  if (mins > 60) {
    const hours = Math.floor(mins / 60)
    return `${hours}h ${mins % 60}m`
  }
  return `${mins}m ${secs}s`
}

function parseInputSource(raw) {
  const value = String(raw || '').trim()
  if (!value) return null
  if (value.startsWith('magnet:')) return value
  if (value.endsWith('.torrent')) return value
  return null
}

export default function Downloader({ settings }) {
  const [downloads, setDownloads] = useState([])
  const [source, setSource] = useState('')
  const [savePath, setSavePath] = useState(settings?.downloadDir || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    vaporApi.downloader.list().then(setDownloads)

    const onProgress = (download) => {
      setDownloads((prev) => {
        const idx = prev.findIndex((item) => item.infoHash === download.infoHash)
        if (idx === -1) return [download, ...prev]
        const next = [...prev]
        next[idx] = { ...next[idx], ...download }
        return next
      })
    }

    const onRemoved = ({ infoHash }) => {
      setDownloads((prev) => prev.filter((item) => item.infoHash !== infoHash))
    }

    vaporApi.on('downloader:progress', onProgress)
    vaporApi.on('downloader:removed', onRemoved)
    return () => {
      vaporApi.off('downloader:progress', onProgress)
      vaporApi.off('downloader:removed', onRemoved)
    }
  }, [])

  const sortedDownloads = useMemo(() => {
    return [...downloads].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }, [downloads])
  const activeCount = sortedDownloads.filter(item => item.status === 'downloading' || item.status === 'paused').length
  const completedCount = sortedDownloads.filter(item => item.status === 'completed').length
  const totalSpeed = sortedDownloads.reduce((sum, item) => sum + (item.downloadSpeed || 0), 0)
  const totalDownloaded = sortedDownloads.reduce((sum, item) => sum + (item.downloaded || 0), 0)

  const chooseTorrentFile = async () => {
    const file = await vaporApi.dialog.file({
      filters: [{ name: 'Torrent Files', extensions: ['torrent'] }],
    })
    if (file) setSource(file)
  }

  const chooseSaveFolder = async () => {
    const folder = await vaporApi.dialog.folder()
    if (folder) setSavePath(folder)
  }

  const startDownload = async () => {
    const parsed = parseInputSource(source)
    if (!parsed) {
      setError('Use a magnet link or select a .torrent file.')
      return
    }

    setError('')
    setBusy(true)
    const result = await vaporApi.downloader.start({ source: parsed, savePath })
    setBusy(false)

    if (!result?.ok) {
      setError(result?.error || 'Failed to start download')
      return
    }

    setSource('')
    vaporApi.downloader.list().then(setDownloads)
  }

  const togglePause = async (item) => {
    if (item.status === 'paused') await vaporApi.downloader.resume(item.infoHash)
    else await vaporApi.downloader.pause(item.infoHash)
  }

  const removeDownload = async (item) => {
    const confirm = window.confirm(
      `Delete "${item.name}" from Vapor and permanently delete downloaded files?\n\nThis cannot be undone.`
    )
    if (!confirm) return
    const result = await vaporApi.downloader.remove(item.infoHash, { deleteData: true })
    if (!result?.ok) setError(result?.error || 'Failed to remove download')
  }

  const clearCompleted = async () => {
    if (completedCount === 0) return
    const confirm = window.confirm(
      `Delete ${completedCount} completed download${completedCount === 1 ? '' : 's'} and permanently remove their files?\n\nThis cannot be undone.`
    )
    if (!confirm) return
    const result = await vaporApi.downloader.clearCompleted({ deleteData: true })
    if (!result?.ok) {
      setError('Some completed downloads could not be removed.')
      return
    }
    vaporApi.downloader.list().then(setDownloads)
  }

  const openDownloadFolder = async (item) => {
    const result = await vaporApi.downloader.openFolder(item.infoHash)
    if (result && result.ok === false) {
      setError(result.error || 'Unable to open download folder.')
    }
  }

  const launchSetupExe = async (item) => {
    const result = await vaporApi.downloader.launchSetup(item.infoHash)
    if (result && result.ok === false) {
      setError(result.error || 'Unable to launch setup.exe.')
    }
  }

  const statusTone = (status) => {
    if (status === 'completed') return { bg: 'var(--surface2)', border: 'var(--green)', color: 'var(--green)' }
    if (status === 'paused') return { bg: 'var(--surface2)', border: 'var(--accent2)', color: 'var(--accent2)' }
    if (status === 'downloading') return { bg: 'var(--accent-dim)', border: 'var(--accent)', color: 'var(--accent)' }
    if (status === 'error') return { bg: 'var(--surface2)', border: 'var(--red)', color: 'var(--red)' }
    if (status === 'cancelled') return { bg: 'var(--surface2)', border: 'var(--border2)', color: 'var(--text-muted)' }
    return { bg: 'var(--surface2)', border: 'var(--border)', color: 'var(--text-muted)' }
  }

  return (
    <div style={{
      height: '100%',
      overflow: 'auto',
      padding: '26px 24px 28px',
      background: 'radial-gradient(circle at 95% -10%, var(--accent-dim) 0%, transparent 35%)',
    }}>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 24, fontWeight: 650, marginBottom: 6, letterSpacing: '-0.01em' }}>Downloader</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          Pull magnet links or .torrent files directly into your library-ready folder.
        </p>
      </div>

      <div style={{
        display:'grid',
        gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))',
        gap:10,
        marginBottom:14,
      }}>
        <StatCard label="Active" value={String(activeCount)} sub="downloading or paused" />
        <StatCard label="Completed" value={String(completedCount)} sub="finished downloads" />
        <StatCard label="Speed" value={humanSpeed(totalSpeed)} sub="combined rate" />
        <StatCard label="Downloaded" value={humanBytes(totalDownloaded)} sub="all sessions" />
      </div>

      <div style={{
        padding: 14,
        borderRadius: 12,
        border: '1px solid var(--border2)',
        background: 'var(--surface)',
        marginBottom: 14,
        boxShadow:'0 14px 35px #00000040',
      }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Paste magnet link or choose a .torrent file"
            style={{
              flex: 1,
              background: 'var(--surface2)',
              border: '1px solid var(--border2)',
              color: 'var(--text)',
              fontSize: 12,
              borderRadius: 8,
              padding: '9px 10px',
            }}
          />
          <button onClick={chooseTorrentFile} style={actionBtn}>Pick .torrent</button>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            value={savePath}
            onChange={(e) => setSavePath(e.target.value)}
            placeholder="Download folder (optional)"
            style={{
              flex: 1,
              background: 'var(--surface2)',
              border: '1px solid var(--border2)',
              color: 'var(--text)',
              fontSize: 12,
              borderRadius: 8,
              padding: '9px 10px',
            }}
          />
          <button onClick={chooseSaveFolder} style={actionBtn}>Folder</button>
          <button onClick={startDownload} disabled={busy} className="btn-accent" style={{ ...actionBtn, borderColor:'var(--accent)' }}>
            {busy ? 'Starting...' : 'Download'}
          </button>
        </div>

        {error && <div style={{ marginTop: 10, color: 'var(--red)', fontSize: 12 }}>{error}</div>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Torrent Downloads
        </span>
        <button
          onClick={clearCompleted}
          disabled={completedCount === 0}
          style={{
            ...actionBtn,
            borderColor: 'var(--border)',
            color: completedCount === 0 ? 'var(--text-muted)' : 'var(--text-dim)',
            opacity: completedCount === 0 ? 0.6 : 1,
          }}
        >
          Clear Completed ({completedCount})
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sortedDownloads.length === 0 && (
          <div style={{
            color: 'var(--text-muted)',
            fontSize: 12,
            padding: '18px 12px',
            borderRadius:10,
            border:'1px dashed var(--border2)',
            background:'var(--surface)'
          }}>
            No torrent downloads yet.
          </div>
        )}

        {sortedDownloads.map((item) => (
          (() => {
            const tone = statusTone(item.status)
            return (
          <div key={item.infoHash} style={{
            borderRadius: 12,
            border: '1px solid var(--border2)',
            background: 'var(--surface)',
            padding: 12,
            boxShadow:'0 10px 24px #0000002f',
          }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.name}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginTop: 4 }}>
                  <span style={{
                    fontSize:10,
                    padding:'2px 8px',
                    borderRadius:999,
                    background:tone.bg,
                    border:'1px solid ' + tone.border,
                    color:tone.color,
                    fontFamily:'var(--mono)'
                  }}>
                    {String(item.status || 'unknown').toUpperCase()}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {humanBytes(item.downloaded)} / {humanBytes(item.length)}
                  </span>
                </div>
                {item.error && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{item.error}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {item.status !== 'completed' && (
                  <button onClick={() => togglePause(item)} style={actionBtn}>
                    {item.status === 'paused' ? 'Resume' : 'Pause'}
                  </button>
                )}
                {item.setupExePath && (
                  <button onClick={() => launchSetupExe(item)} style={actionBtn}>Launch setup.exe</button>
                )}
                <button onClick={() => openDownloadFolder(item)} style={actionBtn}>Open Folder</button>
                <button onClick={() => removeDownload(item)} style={{ ...actionBtn, color: 'var(--red)' }}>Remove</button>
              </div>
            </div>

            <div style={{ height: 7, background: 'var(--surface2)', borderRadius: 999, overflow: 'hidden', marginBottom: 8, border:'1px solid var(--border)' }}>
              <div style={{
                height: '100%',
                width: `${Math.max(0, Math.min(100, item.progress || 0))}%`,
                background: item.status === 'completed' ? 'var(--green)' : 'var(--accent)',
                transition: 'width 0.25s',
              }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
              <span>{item.progress?.toFixed ? item.progress.toFixed(1) : item.progress}% complete</span>
              <span>{humanSpeed(item.downloadSpeed)} · {item.numPeers || 0} peers · ETA {humanEta(item.timeRemaining)}</span>
            </div>
          </div>
            )
          })()
        ))}
      </div>
    </div>
  )
}

function StatCard({ label, value, sub }) {
  return (
    <div style={{
      background:'var(--surface)',
      border:'1px solid var(--border2)',
      borderRadius:10,
      padding:'10px 12px',
      boxShadow:'0 8px 18px #00000028',
    }}>
      <div style={{ fontSize:10, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:4 }}>
        {label}
      </div>
      <div style={{ fontSize:16, fontWeight:600, color:'var(--text)' }}>{value}</div>
      <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{sub}</div>
    </div>
  )
}

const actionBtn = {
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid var(--border2)',
  background: 'var(--surface2)',
  color: 'var(--text-dim)',
  fontSize: 12,
}
