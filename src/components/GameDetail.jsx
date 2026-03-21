import React, { useEffect, useState } from 'react'
import vaporApi from '../vaporApi.js'
import './GameDetail.css'

function fmtTime(mins) {
  if (!mins) return '0 hours'
  const h = Math.floor(mins / 60), m = mins % 60
  return h ? (m ? `${h}h ${m}m` : `${h} hours`) : `${m} minutes`
}
function fmtDate(ts) {
  if (!ts) return 'Never'
  return new Date(ts).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' })
}

export default function GameDetail({
  game,
  running,
  collections,
  onBack,
  onLaunch,
  onUpdate,
  onRemove,
  onToggleFavorite,
  onToggleCollection,
  onOpenSettings,
}) {
  const [editingName, setEditingName] = useState(false)
  const [nameVal, setNameVal]         = useState(game.name)
  const [fetchingArt, setFetchingArt] = useState(false)
  const [manualArt, setManualArt] = useState({
    grid: game.art?.grid || '',
    hero: game.art?.hero || '',
    logo: game.art?.logo || '',
  })
  const [editingExe, setEditingExe] = useState(false)
  const [exeVal, setExeVal] = useState(game.exe || '')
  const [editingSteam, setEditingSteam] = useState(false)
  const [steamVal, setSteamVal] = useState(game.steamAppId || '')
  const [modFolder, setModFolder] = useState(game.modFolder || '')
  const [workshopId, setWorkshopId] = useState('')
  const [steamBusy, setSteamBusy] = useState(false)
  const [steamError, setSteamError] = useState('')
  const [steamInstalled, setSteamInstalled] = useState(null)
  const [steamDownloads, setSteamDownloads] = useState([])

  useEffect(() => {
    setNameVal(game.name)
    setExeVal(game.exe || '')
    setSteamVal(game.steamAppId || '')
    setModFolder(game.modFolder || '')
    setManualArt({
      grid: game.art?.grid || '',
      hero: game.art?.hero || '',
      logo: game.art?.logo || '',
    })
  }, [game])

  useEffect(() => {
    if (!game.steamAppId) return
    vaporApi.steamcmd.status().then(setSteamInstalled)
    vaporApi.steamcmd.list().then((list) => {
      setSteamDownloads(list.filter(item => item.appId === String(game.steamAppId)))
    })

    const onProgress = (record) => {
      if (record.appId !== String(game.steamAppId)) return
      setSteamDownloads(prev => {
        const idx = prev.findIndex(item => item.id === record.id)
        if (idx === -1) return [record, ...prev]
        const next = [...prev]
        next[idx] = record
        return next
      })
    }
    const onRemoved = ({ id }) => {
      setSteamDownloads(prev => prev.filter(item => item.id !== id))
    }

    vaporApi.on('steamcmd:progress', onProgress)
    vaporApi.on('steamcmd:removed', onRemoved)
    return () => {
      vaporApi.off('steamcmd:progress', onProgress)
      vaporApi.off('steamcmd:removed', onRemoved)
    }
  }, [game.steamAppId])

  const fetchArt = async () => {
    setFetchingArt(true)
    const art = await vaporApi.art.fetch(game.name)
    if (art) onUpdate(game.id, { art })
    setFetchingArt(false)
  }

  const saveName = () => {
    if (nameVal.trim()) onUpdate(game.id, { name: nameVal.trim() })
    setEditingName(false)
  }

  const saveManualArt = () => {
    const nextArt = { ...(game.art || {}) }
    ;['grid', 'hero', 'logo'].forEach((key) => {
      const val = (manualArt[key] || '').trim()
      if (val) nextArt[key] = val
      else delete nextArt[key]
    })
    onUpdate(game.id, { art: nextArt })
  }

  const clearManualArt = () => {
    setManualArt({ grid: '', hero: '', logo: '' })
    onUpdate(game.id, { art: {} })
  }

  const browseExe = async () => {
    const result = await vaporApi.dialog.file({ defaultPath: game.folder })
    if (result) {
      setExeVal(result)
    }
  }

  const saveExe = () => {
    const path = exeVal.trim()
    if (path && path !== game.exe) {
      onUpdate(game.id, { exe: path, exeName: path.split(/[\\/]/).pop() })
    }
    setEditingExe(false)
  }

  const saveSteam = () => {
    const id = steamVal.trim()
    onUpdate(game.id, { steamAppId: id || null })
    setEditingSteam(false)
  }

  const browseModFolder = async () => {
    const result = await vaporApi.dialog.folder()
    if (result) {
      setModFolder(result)
      onUpdate(game.id, { modFolder: result })
    }
  }

  const startModDownload = async () => {
    const modId = String(workshopId || '').trim().split('=')[1]?.match(/\d+/)?.[0]
    if (!modId) {
      setSteamError('Enter a valid Workshop Mod ID')
      return
    }
    if (!modFolder) {
      setSteamError('Select a mod folder first')
      return
    }

    setSteamError('')
    setSteamBusy(true)
    const result = await vaporApi.steamcmd.download({
      appId: game.steamAppId,
      workshopId: modId,
      name: `Mod ${modId}`,
      installDir: modFolder,
    })
    setSteamBusy(false)

    if (!result?.ok) {
      setSteamError(result?.error || 'Failed to start download')
      return
    }
    setWorkshopId('')
  }

  const cancelModDownload = async (item) => {
    await vaporApi.steamcmd.cancel(item.id)
  }

  const removeModDownload = async (item) => {
    await vaporApi.steamcmd.remove(item.id)
  }

  const openModFolder = async (item) => {
    await vaporApi.steamcmd.openFolder(item.id)
  }

  const onArtFilePicked = (key, event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setManualArt(prev => ({ ...prev, [key]: reader.result }))
      }
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  return (
    <div style={{ height:'100%', overflow:'auto', position:'relative' }}>
      {/* Hero */}
      <div style={{ position:'relative', height:320, overflow:'hidden', background:'var(--surface)' }}>
        {game.art?.hero ? (
          <img src={game.art.hero} alt="" style={{
            width:'100%', height:'100%', objectFit:'cover', display:'block', opacity:0.55
          }} />
        ) : (
          <div style={{ width:'100%', height:'100%', background:'linear-gradient(135deg, var(--surface) 0%, #1a1a2e 50%, var(--surface) 100%)' }} />
        )}
        <div style={{
          position:'absolute', inset:0,
          background:'linear-gradient(to bottom, transparent 20%, var(--bg) 100%)'
        }} />

        {/* Back */}
        <button onClick={onBack} style={{
          position:'absolute', top:20, left:20, display:'flex', alignItems:'center', gap:6,
          color:'#fff', fontSize:13, opacity:0.9,
          background:'#00000050', padding:'8px 14px', borderRadius:8,
          backdropFilter:'blur(8px)', border:'1px solid #ffffff20', cursor:'pointer',
          fontFamily:'inherit', boxShadow:'0 4px 16px #00000040'
        }} className="gd-btn">
          ← Back
        </button>

        {/* Logo or name overlay */}
        <div style={{ position:'absolute', bottom:28, left:28, right:28, display:'flex', alignItems:'flex-end', gap:20 }}>
          {game.art?.grid && (
            <img src={game.art.grid} alt="" style={{
              width:100, height:150, objectFit:'cover', borderRadius:10,
              boxShadow:'0 12px 40px #00000080', flexShrink:0,
              border:'2px solid var(--border2)'
            }} />
          )}
          <div style={{ flex:1 }}>
            {game.art?.logo ? (
              <img 
                src={game.art.logo} 
                alt={game.name} 
                style={{ 
                  maxHeight:90, 
                  maxWidth:380, 
                  objectFit:'contain',
                  filter: 'drop-shadow(0 4px 12px #00000080)',
                  padding: '4px 8px',
                }} 
                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling && (e.target.nextSibling.style.display = 'block'); }}
              />
            ) : null}
            <h1 style={{ fontSize:34, fontWeight:700, color:'#fff', textShadow:'0 4px 20px #000', letterSpacing:'-0.02em', display: game.art?.logo ? 'none' : 'block' }}>
              {game.name}
            </h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding:'28px 28px 48px', maxWidth:1100 }}>
        <div style={{ display:'grid', gridTemplateColumns:'220px 1fr', gap:24, alignItems:'flex-start' }}>
          {/* Left - actions */}
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <button
              onClick={() => onLaunch(game)}
              disabled={running}
              style={{
                padding:'14px 24px', borderRadius:10, fontSize:15, fontWeight:700,
                background: running ? 'linear-gradient(135deg, #4ade80, #22c55e)' : 'linear-gradient(135deg, #7c6fff, #6c63ff)',
                color:'#fff', border:'none', cursor:'pointer', fontFamily:'inherit',
                boxShadow: running ? '0 6px 24px #4ade8040' : '0 6px 24px #6c63ff40',
                letterSpacing:'0.02em'
              }}
              className="gd-btn"
            >
              {running ? '● Running' : '▶ Play Now'}
            </button>

            <button onClick={() => onOpenSettings && onOpenSettings(game)} style={{
              padding:'10px 16px', borderRadius:8, fontSize:13,
              background:'var(--surface2)', color:'var(--text)',
              border:'1px solid var(--border)', cursor:'pointer', fontFamily:'inherit',
              display:'flex', alignItems:'center', gap:8
            }} className="gd-btn">
              <span style={{ fontSize:15 }}>⚙</span> Game Settings
            </button>

            <button onClick={fetchArt} disabled={fetchingArt} style={{
              padding:'10px 16px', borderRadius:8, fontSize:13,
              background:'var(--surface2)', color:'var(--text)',
              border:'1px solid var(--border)', cursor:'pointer', fontFamily:'inherit',
              display:'flex', alignItems:'center', gap:8
            }} className="gd-btn">
              <span style={{ fontSize:15 }}>🎨</span> {fetchingArt ? 'Fetching...' : 'Fetch Art'}
            </button>

            <button onClick={() => onToggleFavorite(game.id)} style={{
              padding:'10px 16px', borderRadius:8, fontSize:13,
              background: game.favorite ? '#f59e0b18' : 'var(--surface2)',
              color: game.favorite ? '#f59e0b' : 'var(--text)',
              border:'1px solid ' + (game.favorite ? '#f59e0b40' : 'var(--border)'),
              cursor:'pointer', fontFamily:'inherit',
              display:'flex', alignItems:'center', gap:8
            }} className="gd-btn">
              <span style={{ fontSize:15 }}>{game.favorite ? '★' : '☆'}</span> {game.favorite ? 'Favorited' : 'Add to Favorites'}
            </button>

            <div style={{ height:1, background:'var(--border)', margin:'8px 0' }} />

            <button onClick={() => onRemove(game.id)} style={{
              padding:'10px 16px', borderRadius:8, fontSize:13,
              background:'transparent', color:'#f87171',
              border:'1px solid #f8717130', cursor:'pointer', fontFamily:'inherit',
              display:'flex', alignItems:'center', gap:8
            }} className="gd-btn">
              <span style={{ fontSize:15 }}>🗑</span> Remove Game
            </button>
          </div>

          {/* Right - metadata */}
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {/* Stats Card */}
            <div className="gd-section">
              <div style={{ display:'flex', gap:32, flexWrap:'wrap' }}>
                <Stat label="Playtime" value={fmtTime(game.playtime)} icon="⏱" />
                <Stat label="Last Played" value={fmtDate(game.lastPlayed)} icon="📅" />
                {game.art?.sgdbName && game.art.sgdbName !== game.name && (
                  <Stat label="Matched As" value={game.art.sgdbName} icon="🔗" />
                )}
              </div>
            </div>

            {/* Genres */}
            {game.genres?.length > 0 && (
              <div className="gd-section">
                <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.1em', fontWeight:600 }}>Genres</div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {game.genres.map(g => (
                    <span key={g} style={{
                      fontSize:12, padding:'5px 12px', borderRadius:16,
                      background:'var(--accent-dim)', border:'1px solid #6c63ff30',
                      color:'var(--accent)'
                    }} className="gd-tag">{g}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Collections */}
            {collections?.length > 0 && (
              <div className="gd-section">
                <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.1em', fontWeight:600 }}>
                  Collections
                </div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {collections.map(c => {
                    const inCollection = (game.collections || []).includes(c.id)
                    return (
                      <button
                        key={c.id}
                        onClick={() => onToggleCollection(game.id, c.id)}
                        style={{
                          fontSize:12,
                          padding:'6px 14px',
                          borderRadius:16,
                          background: inCollection ? 'var(--accent)' : 'var(--surface)',
                          border:'1px solid ' + (inCollection ? 'var(--accent)' : 'var(--border)'),
                          color: inCollection ? '#fff' : 'var(--text-dim)',
                          cursor:'pointer', fontFamily:'inherit',
                          transition:'all 0.12s ease'
                        }}
                        className="gd-tag"
                      >
                        {inCollection ? '✓ ' : '+ '}{c.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Steam Workshop Mods */}
            {game.steamAppId && (
              <div className="gd-section">
                <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:12, textTransform:'uppercase', letterSpacing:'0.1em', fontWeight:600, display:'flex', alignItems:'center', gap:8 }}>
                  <span>🎮</span> Steam Workshop Mods
                </div>

                <div style={{ display:'flex', gap:10, marginBottom:10 }}>
                  <input
                    value={modFolder}
                    onChange={e => setModFolder(e.target.value)}
                    placeholder="Mod download folder"
                    className="gd-input"
                  />
                  <button onClick={browseModFolder} style={{ padding:'10px 16px', borderRadius:8, background:'var(--surface)', color:'var(--text)', border:'1px solid var(--border)', fontSize:12, cursor:'pointer', fontFamily:'inherit' }} className="gd-btn">Browse</button>
                </div>

                <div style={{ display:'flex', gap:10, marginBottom:10 }}>
                  <input
                    value={workshopId}
                    onChange={e => setWorkshopId(e.target.value)}
                    placeholder="Workshop Mod URL or ID"
                    className="gd-input"
                  />
                  <button
                    onClick={startModDownload}
                    disabled={steamBusy || !modFolder || steamInstalled?.installed === false}
                    style={{
                      padding:'10px 18px', borderRadius:8, background:'var(--accent)', color:'#fff', fontSize:13, fontWeight:600,
                      border:'none', cursor:'pointer', fontFamily:'inherit',
                      opacity: steamBusy || !modFolder || steamInstalled?.installed === false ? 0.5 : 1
                    }}
                    className="gd-btn"
                  >
                    {steamBusy ? '⏳ Downloading...' : '⬇ Download'}
                  </button>
                </div>

                {steamError && (
                  <div style={{ fontSize:12, color:'#f87171', marginBottom:10, padding:'8px 12px', background:'#f8717115', borderRadius:6, border:'1px solid #f8717130' }}>{steamError}</div>
                )}

                {steamDownloads.length > 0 && (
                  <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:14 }}>
                    {steamDownloads.map(item => (
                      <div key={item.id} style={{
                        padding:'12px 14px', borderRadius:10, background:'var(--surface)',
                        border:'1px solid var(--border)', display:'flex', alignItems:'center', gap:12
                      }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontWeight:500 }}>
                            {item.name}
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4 }}>
                            <span style={{
                              fontSize:10, padding:'2px 8px', borderRadius:999,
                              background: item.status === 'completed' ? 'var(--green)18' : item.status === 'error' ? '#f8717118' : 'var(--accent-dim)',
                              color: item.status === 'completed' ? 'var(--green)' : item.status === 'error' ? '#f87171' : 'var(--accent)',
                              fontWeight:600
                            }}>
                              {item.status.toUpperCase()}
                            </span>
                            <span style={{ fontSize:12, color:'var(--text-muted)' }}>
                              {item.progress}%
                            </span>
                            {item.status === 'downloading' && (
                                <div style={{ width:60, height:4, background:'var(--surface2)', borderRadius:2, overflow:'hidden' }}>
                                <div style={{ width:item.progress+'%', height:'100%', background:'var(--green)', transition:'width 0.3s' }} />
                              </div>
                            )}
                          </div>
                          {item.error && <div style={{ fontSize:11, color:'#f87171', marginTop:4 }}>{item.error}</div>}
                        </div>
                        <div style={{ display:'flex', gap:6 }}>
                          {item.status === 'downloading' && (
                            <button onClick={() => cancelModDownload(item)} style={{ fontSize:11, padding:'6px 10px', borderRadius:6, background:'var(--surface2)', color:'#f87171', border:'1px solid var(--border)', cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                          )}
                          <button onClick={() => openModFolder(item)} style={{ fontSize:11, padding:'6px 10px', borderRadius:6, background:'var(--surface2)', color:'var(--text)', border:'1px solid var(--border)', cursor:'pointer', fontFamily:'inherit' }}>Open</button>
                          <button onClick={() => removeModDownload(item)} style={{ fontSize:11, padding:'6px 10px', borderRadius:6, background:'var(--surface2)', color:'#f87171', border:'1px solid var(--border)', cursor:'pointer', fontFamily:'inherit' }}>Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, icon }) {
  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
        {icon && <span style={{ fontSize:12 }}>{icon}</span>}
        <span style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.1em', fontWeight:600 }}>{label}</span>
      </div>
      <div style={{ fontSize:15, fontWeight:600, color:'var(--text)' }}>{value}</div>
    </div>
  )
}
