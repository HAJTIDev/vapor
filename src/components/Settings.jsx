import React, { useState, useEffect, useMemo } from 'react'
import vaporApi from '../vaporApi'
import { themes, getThemeNames } from '../themes'
import { formatFileSize } from '../utils'

export default function Settings({ settings, onSave, games, onRefreshAllArt }) {
  const [saved, setSaved] = useState(false)
  const [newCollection, setNewCollection] = useState('')
  const [updateStatus, setUpdateStatus] = useState(null)
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [refreshingArt, setRefreshingArt] = useState(false)
  const [artRefreshProgress, setArtRefreshProgress] = useState(null)
  const [downloadLimitKbps, setDownloadLimitKbps] = useState(Math.max(0, Math.round(Number(settings?.downloadSpeedLimitKbps) || 0)))

  const sliderMaxKbps = 4096
  const sliderStepKbps = 64

  useEffect(() => {
    const handleUpdateStatus = (data) => {
      setUpdateStatus(data)
      setCheckingUpdate(false)
    }
    vaporApi.on('update:status', handleUpdateStatus)
    return () => vaporApi.off('update:status', handleUpdateStatus)
  }, [])

  useEffect(() => {
    setDownloadLimitKbps(Math.max(0, Math.round(Number(settings?.downloadSpeedLimitKbps) || 0)))
  }, [settings?.downloadSpeedLimitKbps])

  const checkForUpdates = async () => {
    setCheckingUpdate(true)
    setUpdateStatus({ status: 'checking' })
    await vaporApi.update.check()
  }

  const downloadUpdate = async () => {
    await vaporApi.update.download()
  }

  const installUpdate = async () => {
    await vaporApi.update.install()
  }

  const refreshAllArt = async () => {
    const gamesNeedingArt = (games || []).filter(g => !g.art?.grid)
    if (gamesNeedingArt.length === 0) {
      alert('All games already have cover art.')
      return
    }
    setRefreshingArt(true)
    setArtRefreshProgress({ done: 0, total: gamesNeedingArt.length })
    for (let i = 0; i < gamesNeedingArt.length; i++) {
      const game = gamesNeedingArt[i]
      const art = await vaporApi.art.fetch(game.name)
      if (art && !art.error) {
        onRefreshAllArt && onRefreshAllArt(game.id, art)
      }
      setArtRefreshProgress({ done: i + 1, total: gamesNeedingArt.length })
    }
    setRefreshingArt(false)
    setArtRefreshProgress(null)
  }

  const getStatusText = () => {
    if (!updateStatus) return null
    switch (updateStatus.status) {
      case 'checking': return 'Checking for updates...'
      case 'available': return `Update available: v${updateStatus.version}`
      case 'not-available': return 'You have the latest version'
      case 'downloading': return `Downloading: ${Math.round(updateStatus.progress || 0)}%`
      case 'downloaded': return `Update ready to install (v${updateStatus.version})`
      case 'error': return `Error: ${updateStatus.error}`
      default: return null
    }
  }

  const save = () => {
    onSave(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const updateUi = (patch) => {
    onSave({ ...settings, ui: { ...(settings.ui || {}), ...patch } })
  }

  const addCollection = () => {
    const name = newCollection.trim()
    if (!name) return
    const exists = (settings.collections || []).some(c => c.name.toLowerCase() === name.toLowerCase())
    if (exists) return
    const id = `col_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
    onSave({
      ...settings,
      collections: [...(settings.collections || []), { id, name }],
    })
    setNewCollection('')
  }

  const removeCollection = (id) => {
    const ok = window.confirm('Delete this collection? Games will stay in your library.')
    if (!ok) return
    onSave({
      ...settings,
      collections: (settings.collections || []).filter(c => c.id !== id),
    })
  }

  const applyDownloadLimit = async (value) => {
    const next = Math.max(0, Math.round(Number(value) || 0))
    setDownloadLimitKbps(next)

    onSave({ ...settings, downloadSpeedLimitKbps: next })

    const result = await vaporApi.downloader.setLimit(next)
    if (!result?.ok) {
      console.error('[settings] Failed to apply download limit:', result?.error || 'Unknown error')
    }
  }

  const storageByDrive = useMemo(() => {
    const groups = new Map()

    const inferDrive = (game) => {
      const sourcePath = String(game?.folder || game?.exe || '').trim()
      if (!sourcePath) return 'Unknown'

      // Windows style: C:\Games\...
      const winMatch = sourcePath.match(/^([a-zA-Z]):[\\/]/)
      if (winMatch) return `${winMatch[1].toUpperCase()}:`

      // Unix-like fallback: /mnt/d/... or /
      const mntMatch = sourcePath.match(/^\/mnt\/([a-zA-Z])\//)
      if (mntMatch) return `${mntMatch[1].toUpperCase()}:`
      if (sourcePath.startsWith('/')) return '/'

      return 'Unknown'
    }

    for (const game of games || []) {
      const drive = inferDrive(game)
      const fileSize = Math.max(0, Number(game?.fileSize) || 0)
      const current = groups.get(drive) || { drive, totalBytes: 0, gameCount: 0, sizedGameCount: 0 }
      current.totalBytes += fileSize
      current.gameCount += 1
      if (fileSize > 0) current.sizedGameCount += 1
      groups.set(drive, current)
    }

    return Array.from(groups.values()).sort((a, b) => b.totalBytes - a.totalBytes)
  }, [games])

  return (
    <div style={{ height:'100%', overflow:'auto', padding:'28px 28px' }}>
      <h2 style={{ fontSize:18, fontWeight:600, marginBottom:4 }}>Settings</h2>
      <p style={{ color:'var(--text-muted)', fontSize:13, marginBottom:28 }}>Configure Vapor</p>

      <Section title="Updates">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
          <div style={{ fontSize:13, color:'var(--text)' }}>
            {getStatusText() || 'Check for updates'}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            {updateStatus?.status === 'available' && (
              <button onClick={downloadUpdate} style={{
                padding:'7px 14px', borderRadius:6, fontSize:12,
                background:'var(--accent)', color:'#fff'
              }}>
                Download
              </button>
            )}
            {updateStatus?.status === 'downloaded' && (
              <button onClick={installUpdate} style={{
                padding:'7px 14px', borderRadius:6, fontSize:12,
                background:'var(--accent)', color:'#fff'
              }}>
                Install & Restart
              </button>
            )}
            {(updateStatus?.status === 'not-available' || updateStatus?.status === 'error') && (
              <button onClick={checkForUpdates} disabled={checkingUpdate} style={{
                padding:'7px 14px', borderRadius:6, fontSize:12,
                background:'var(--surface2)', color:'var(--text)', border:'1px solid var(--border)',
                opacity: checkingUpdate ? 0.6 : 1
              }}>
                Check Again
              </button>
            )}
            {(!updateStatus || updateStatus?.status === 'checking' || updateStatus?.status === 'downloading') && (
              <button onClick={checkForUpdates} disabled={checkingUpdate} style={{
                padding:'7px 14px', borderRadius:6, fontSize:12,
                background:'var(--surface2)', color:'var(--text)', border:'1px solid var(--border)',
                opacity: checkingUpdate ? 0.6 : 1
              }}>
                {checkingUpdate ? 'Checking...' : 'Check for Updates'}
              </button>
            )}
          </div>
        </div>
        <div style={{ marginTop:12 }}>
          <ToggleRow
            label="Auto-check for Updates"
            desc="Automatically check for updates on startup."
            checked={!!settings.ui?.autoUpdate}
            onChange={(checked) => onSave({ ...settings, ui: { ...(settings.ui || {}), autoUpdate: checked } })}
          />
        </div>
      </Section>

      <Section title="Storage">
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:13, color:'var(--text)', marginBottom:4 }}>Total Storage Used</div>
          <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
            <div style={{ fontSize:28, fontWeight:700, color:'var(--accent)' }}>
              {formatFileSize((games || []).reduce((sum, g) => sum + (g.fileSize || 0), 0))}
            </div>
            <div style={{ fontSize:12, color:'var(--text-muted)' }}>
              across {(games || []).length} game{(games || []).length !== 1 ? 's' : ''}
            </div>
          </div>
          <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:6 }}>
            File sizes are calculated when games are added or scanned.
          </div>
        </div>

        {storageByDrive.length > 0 && (
          <div style={{ marginTop:16 }}>
            <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.1em', fontWeight:600, marginBottom:10 }}>
              Storage by Drive
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {storageByDrive.map((row) => (
                <div key={row.drive} style={{
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                  background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:6,
                  padding:'8px 10px', gap:12,
                }}>
                  <div style={{ display:'flex', flexDirection:'column', minWidth:0 }}>
                    <span style={{ fontSize:12, color:'var(--text)', fontWeight:600 }}>{row.drive}</span>
                    <span style={{ fontSize:11, color:'var(--text-muted)' }}>
                      {row.gameCount} game{row.gameCount !== 1 ? 's' : ''} ({row.sizedGameCount} with size data)
                    </span>
                  </div>
                  <span style={{ fontSize:12, color:'var(--text-dim)', fontFamily:'var(--mono)', flexShrink:0 }}>
                    {formatFileSize(row.totalBytes)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(games || []).length > 0 && (
          <div style={{ marginTop:16 }}>
            <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.1em', fontWeight:600, marginBottom:10 }}>
              Top Games by Size
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:240, overflow:'auto' }}>
              {(games || [])
                .sort((a, b) => (b.fileSize || 0) - (a.fileSize || 0))
                .slice(0, 10)
                .map(g => (
                  <div key={g.id} style={{
                    display:'flex', justifyContent:'space-between', alignItems:'center',
                    background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:6,
                    padding:'8px 10px'
                  }}>
                    <span style={{ fontSize:12, color:'var(--text-dim)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {g.name}
                    </span>
                    <span style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'var(--mono)', marginLeft:12, flexShrink:0 }}>
                      {formatFileSize(g.fileSize || 0)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </Section>

      <Section title="Artwork">
        <Info>
          Vapor uses <b>SteamGridDB</b> to fetch cover art, hero banners, logos and icons.
          Art is fetched automatically when you add games.
        </Info>
        <div style={{ marginTop:16 }}>
          <button
            onClick={refreshAllArt}
            disabled={refreshingArt}
            style={{
              padding:'8px 16px', borderRadius:6, fontSize:12, fontWeight:500,
              background: refreshingArt ? 'var(--surface2)' : 'var(--accent)',
              color:'#fff', border:'none', cursor: refreshingArt ? 'default' : 'pointer',
              opacity: refreshingArt ? 0.8 : 1
            }}
          >
            {refreshingArt ? `Refreshing... ${artRefreshProgress?.done || 0}/${artRefreshProgress?.total || 0}` : 'Refresh All Artwork'}
          </button>
          {(games || []).filter(g => !g.art?.grid).length > 0 && !refreshingArt && (
            <span style={{ fontSize:12, color:'var(--text-muted)', marginLeft:12 }}>
              {(games || []).filter(g => !g.art?.grid).length} games missing cover art
            </span>
          )}
        </div>
      </Section>

      <Section title="Collections">
        <div style={{ display:'flex', gap:8, marginBottom:12 }}>
          <input
            value={newCollection}
            onChange={e => setNewCollection(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addCollection() }}
            placeholder="Create a collection (e.g. Roguelikes)"
            style={{
              flex:1,
              background:'var(--surface2)',
              border:'1px solid var(--border)',
              borderRadius:6,
              padding:'8px 10px',
              color:'var(--text)',
              fontSize:13,
            }}
          />
          <button onClick={addCollection} style={{
            padding:'8px 12px', borderRadius:6, fontSize:12,
            background:'var(--accent)', color:'#fff'
          }}>
            Add
          </button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {(settings.collections || []).map(c => (
            <div key={c.id} style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:6,
              padding:'8px 10px'
            }}>
              <span style={{ fontSize:13, color:'var(--text-dim)' }}>{c.name}</span>
              <button onClick={() => removeCollection(c.id)} style={{
                padding:'4px 8px', borderRadius:5, fontSize:11,
                color:'var(--red)', background:'transparent', border:'1px solid #f8717130'
              }}>
                Delete
              </button>
            </div>
          ))}
          {(settings.collections || []).length === 0 && (
            <div style={{ fontSize:12, color:'var(--text-muted)' }}>No custom collections yet.</div>
          )}
        </div>
      </Section>

      <Section title="Settings">
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:12, color:'var(--text-dim)', marginBottom:6 }}>Theme</div>
          <select
            value={settings.theme || 'dark'}
            onChange={(e) => onSave({ ...settings, theme: e.target.value })}
            style={{
              background:'var(--surface2)',
              color:'var(--text)',
              border:'1px solid var(--border)',
              borderRadius:6,
              padding:'8px 10px',
              fontSize:12,
              cursor:'pointer',
            }}
          >
            {getThemeNames().map(themeName => (
              <option key={themeName} value={themeName}>
                {themes[themeName]?.name || themeName}
              </option>
            ))}
          </select>
          <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:6 }}>
            Choose your preferred color theme.
          </div>
        </div>
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:12, color:'var(--text-dim)', marginBottom:6 }}>Download Directory</div>
          <div style={{ display:'flex', gap:8 }}>
            <input
              value={settings.downloadDir || ''}
              readOnly
              placeholder="No directory selected"
              style={{
                flex:1,
                background:'var(--surface2)',
                border:'1px solid var(--border)',
                borderRadius:6,
                padding:'8px 10px',
                color:'var(--text)',
                fontSize:13,
              }}
            />
            <button
              onClick={async () => {
                const dir = await vaporApi.dialog.folder()
                if (dir) {
                  onSave({ ...settings, downloadDir: dir })
                }
              }}
              style={{
                padding:'8px 12px',
                borderRadius:6,
                fontSize:12,
                background:'var(--accent)',
                color:'#fff',
                border:'none',
                cursor:'pointer',
              }}
            >
              Browse
            </button>
          </div>
          <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:6 }}>
            Directory where downloaded games will be installed.
          </div>
        </div>
        <ToggleRow
          label="Start with System"
          desc="Launch Vapor automatically when you log in to Windows."
          checked={!!settings.ui?.autoStart}
          onChange={(checked) => {
            updateUi({ autoStart: checked })
            vaporApi.settings.setAutoStart(checked)
          }}
        />
        <ToggleRow
          label="Show Playtime In Sidebar"
          desc="Displays each game's total playtime in the left game list."
          checked={!!settings.ui?.showPlaytimeInSidebar}
          onChange={(checked) => updateUi({ showPlaytimeInSidebar: checked })}
        />
        <ToggleRow
          label="Compact Sidebar"
          desc="Shrinks the left panel width to fit more screen space."
          checked={!!settings.ui?.compactSidebar}
          onChange={(checked) => updateUi({ compactSidebar: checked })}
        />
        <ToggleRow
          label="Confirm Before Removing Games"
          desc="Prevents accidental removals from your library."
          checked={!!settings.ui?.confirmRemoveGame}
          onChange={(checked) => updateUi({ confirmRemoveGame: checked })}
        />
        <ToggleRow
          label="Discord Rich Presence"
          desc="Shows what you're playing on your Discord status."
          checked={!!settings.ui?.discordRpc}
          onChange={(checked) => updateUi({ discordRpc: checked })}
        />

        <div style={{ marginTop:14 }}>
          <div style={{ fontSize:12, color:'var(--text-dim)', marginBottom:6 }}>Download Speed Limit</div>
          <div style={{
            width: 260,
            maxWidth: '100%',
            background:'var(--surface2)',
            border:'1px solid var(--border)',
            borderRadius:8,
            padding:'8px 10px',
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text-muted)', marginBottom:6 }}>
              <span>Limiter</span>
              <span>{downloadLimitKbps <= 0 ? 'Unlimited' : `${downloadLimitKbps} KB/s`}</span>
            </div>
            <input
              type="range"
              min={0}
              max={sliderMaxKbps}
              step={sliderStepKbps}
              value={Math.min(sliderMaxKbps, Math.max(0, downloadLimitKbps))}
              onChange={(e) => setDownloadLimitKbps(Math.round(Number(e.target.value) || 0))}
              onMouseUp={() => applyDownloadLimit(downloadLimitKbps)}
              onTouchEnd={() => applyDownloadLimit(downloadLimitKbps)}
              style={{ width:'100%', accentColor:'var(--accent)' }}
            />
            <div style={{ display:'flex', gap:6, marginTop:6 }}>
              <button
                onClick={() => applyDownloadLimit(0)}
                style={{
                  padding:'4px 8px',
                  borderRadius:6,
                  fontSize:11,
                  background:'var(--surface)',
                  color:'var(--text-dim)',
                  border:'1px solid var(--border)',
                }}
              >
                Unlimited
              </button>
              <button
                onClick={() => applyDownloadLimit(1024)}
                style={{
                  padding:'4px 8px',
                  borderRadius:6,
                  fontSize:11,
                  background:'var(--surface)',
                  color:'var(--text-dim)',
                  border:'1px solid var(--border)',
                }}
              >
                1 MB/s
              </button>
            </div>
          </div>
          <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:6 }}>
            Applies globally to all active torrents.
          </div>
        </div>

        <div style={{ marginTop:14 }}>
          <div style={{ fontSize:12, color:'var(--text-dim)', marginBottom:6 }}>Sidebar Sort</div>
          <select
            value={settings.ui?.sidebarSort || 'recent'}
            onChange={(e) => updateUi({ sidebarSort: e.target.value })}
            style={{
              background:'var(--surface2)',
              color:'var(--text)',
              border:'1px solid var(--border)',
              borderRadius:6,
              padding:'7px 10px',
              fontSize:12,
            }}
          >
            <option value="recent">Last Played</option>
            <option value="name">Name</option>
            <option value="playtime">Playtime</option>
          </select>
        </div>
      </Section>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom:28 }}>
      <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12 }}>{title}</div>
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:'16px 18px' }}>
        {children}
      </div>
    </div>
  )
}

function Info({ children }) {
  return <div style={{ fontSize:13, color:'var(--text-dim)', lineHeight:1.7 }}>{children}</div>
}

function ToggleRow({ label, desc, checked, onChange }) {
  return (
    <label style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, marginBottom:10, cursor:'pointer' }}>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:13, color:'var(--text)', marginBottom:2 }}>{label}</div>
        <div style={{ fontSize:11, color:'var(--text-muted)' }}>{desc}</div>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          width:44,
          height:24,
          borderRadius:12,
          padding:2,
          border:'none',
          cursor:'pointer',
          background: checked ? 'var(--accent)' : 'var(--surface2)',
          transition:'background 0.2s ease',
          flexShrink:0,
        }}
      >
        <div style={{
          width:20,
          height:20,
          borderRadius:'50%',
          background:'#fff',
          transition:'transform 0.2s ease',
          transform: checked ? 'translateX(20px)' : 'translateX(0)',
          boxShadow:'0 1px 3px rgba(0,0,0,0.3)',
        }} />
      </button>
    </label>
  )
}
