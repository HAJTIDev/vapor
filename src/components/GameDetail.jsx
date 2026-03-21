import React, { useEffect, useState } from 'react'
import vaporApi from '../vaporApi.js'

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

  useEffect(() => {
    setNameVal(game.name)
    setExeVal(game.exe || '')
    setSteamVal(game.steamAppId || '')
    setManualArt({
      grid: game.art?.grid || '',
      hero: game.art?.hero || '',
      logo: game.art?.logo || '',
    })
  }, [game])

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
      <div style={{ position:'relative', height:280, overflow:'hidden', background:'var(--surface)' }}>
        {game.art?.hero ? (
          <img src={game.art.hero} alt="" style={{
            width:'100%', height:'100%', objectFit:'cover', display:'block', opacity:0.6
          }} />
        ) : (
          <div style={{ width:'100%', height:'100%', background:'linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%)' }} />
        )}
        <div style={{
          position:'absolute', inset:0,
          background:'linear-gradient(to bottom, transparent 30%, var(--bg) 100%)'
        }} />

        {/* Back */}
        <button onClick={onBack} style={{
          position:'absolute', top:16, left:16, display:'flex', alignItems:'center', gap:6,
          color:'#fff', fontSize:13, opacity:0.8,
          background:'#00000040', padding:'6px 12px', borderRadius:6,
          backdropFilter:'blur(4px)'
        }}>
          ← Back
        </button>

        {/* Logo or name overlay */}
        <div style={{ position:'absolute', bottom:20, left:24, right:24, display:'flex', alignItems:'flex-end', gap:16 }}>
          {game.art?.grid && (
            <img src={game.art.grid} alt="" style={{
              width:90, height:135, objectFit:'cover', borderRadius:6,
              boxShadow:'0 8px 32px #00000080', flexShrink:0,
              border:'1px solid var(--border2)'
            }} />
          )}
          <div style={{ flex:1 }}>
            {game.art?.logo ? (
              <img src={game.art.logo} alt={game.name} style={{ maxHeight:70, maxWidth:300, objectFit:'contain' }} />
            ) : (
              <h1 style={{ fontSize:28, fontWeight:700, color:'#fff', textShadow:'0 2px 8px #000' }}>
                {game.name}
              </h1>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding:'24px 24px 40px' }}>
        <div style={{ display:'flex', gap:16, flexWrap:'wrap', alignItems:'flex-start' }}>
          {/* Left - actions */}
          <div style={{ display:'flex', flexDirection:'column', gap:10, minWidth:200 }}>
            <button
              onClick={() => onLaunch(game)}
              disabled={running}
              style={{
                padding:'12px 24px', borderRadius:7, fontSize:14, fontWeight:600,
                background: running ? 'var(--green)' : 'var(--accent)',
                color:'#fff', opacity: running ? 0.9 : 1,
                boxShadow: running ? '0 0 20px #4ade8040' : '0 0 20px #6c63ff30'
              }}
            >
              {running ? '▶ Running' : '▶ Play'}
            </button>

            <button onClick={() => onToggleFavorite(game.id)} style={{
              padding:'8px 16px', borderRadius:6, fontSize:12,
              background: game.favorite ? '#f59e0b22' : 'var(--surface2)',
              color: game.favorite ? '#f59e0b' : 'var(--text-dim)',
              border:'1px solid ' + (game.favorite ? '#f59e0b55' : 'var(--border)'),
            }}>
              {game.favorite ? '★ Favorited' : '☆ Add Favorite'}
            </button>

            <button onClick={fetchArt} disabled={fetchingArt} style={{
              padding:'8px 16px', borderRadius:6, fontSize:12,
              background:'var(--surface2)', color:'var(--text-dim)',
              border:'1px solid var(--border)', transition:'all 0.12s'
            }}>
              {fetchingArt ? 'Fetching...' : '🎨 Fetch Art'}
            </button>

            <button onClick={() => onRemove(game.id)} style={{
              padding:'8px 16px', borderRadius:6, fontSize:12,
              background:'transparent', color:'var(--red)',
              border:'1px solid #f8717130', transition:'all 0.12s'
            }}>
              Remove from Library
            </button>
          </div>

          {/* Right - metadata */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', gap:20 }}>
            {/* Editable name */}
            <div>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.08em' }}>Game Name</div>
              {editingName ? (
                <div style={{ display:'flex', gap:8 }}>
                  <input value={nameVal} onChange={e => setNameVal(e.target.value)}
                    onKeyDown={e => { if(e.key==='Enter') saveName(); if(e.key==='Escape') setEditingName(false) }}
                    autoFocus
                    style={{
                      flex:1, background:'var(--surface2)', border:'1px solid var(--accent)',
                      borderRadius:6, padding:'6px 10px', color:'var(--text)', fontSize:14
                    }}
                  />
                  <button onClick={saveName} style={{ padding:'6px 12px', borderRadius:6, background:'var(--accent)', color:'#fff', fontSize:12 }}>Save</button>
                </div>
              ) : (
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:16, fontWeight:500 }}>{game.name}</span>
                  <button onClick={() => { setNameVal(game.name); setEditingName(true) }}
                    style={{ fontSize:11, color:'var(--text-muted)', padding:'2px 8px', borderRadius:4, background:'var(--surface2)', border:'1px solid var(--border)' }}>
                    Edit
                  </button>
                </div>
              )}
            </div>

            {/* Stats */}
            <div style={{ display:'flex', gap:24, flexWrap:'wrap' }}>
              <Stat label="Playtime" value={fmtTime(game.playtime)} />
              <Stat label="Last Played" value={fmtDate(game.lastPlayed)} />
              {game.art?.sgdbName && game.art.sgdbName !== game.name && (
                <Stat label="Matched As" value={game.art.sgdbName} />
              )}
            </div>

            {/* Genres */}
            {game.genres?.length > 0 && (
              <div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.08em' }}>Genres</div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {game.genres.map(g => (
                    <span key={g} style={{
                      fontSize:11, padding:'3px 10px', borderRadius:20,
                      background:'var(--surface2)', border:'1px solid var(--border)',
                      color:'var(--text-dim)'
                    }}>{g}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Collections */}
            {collections?.length > 0 && (
              <div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.08em' }}>
                  Collections
                </div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {collections.map(c => {
                    const inCollection = (game.collections || []).includes(c.id)
                    return (
                      <button
                        key={c.id}
                        onClick={() => onToggleCollection(game.id, c.id)}
                        style={{
                          fontSize:11,
                          padding:'4px 10px',
                          borderRadius:20,
                          background: inCollection ? 'var(--accent-dim)' : 'var(--surface2)',
                          border:'1px solid ' + (inCollection ? '#6c63ff55' : 'var(--border)'),
                          color: inCollection ? 'var(--accent)' : 'var(--text-dim)',
                        }}
                      >
                        {inCollection ? '✓ ' : ''}{c.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Exe path */}
            <div>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.08em' }}>Executable</div>
              {editingExe ? (
                <div style={{ display:'flex', gap:8 }}>
                  <input value={exeVal} onChange={e => setExeVal(e.target.value)}
                    autoFocus
                    style={{
                      flex:1, background:'var(--surface2)', border:'1px solid var(--accent)',
                      borderRadius:6, padding:'6px 10px', color:'var(--text)', fontSize:11, fontFamily:'var(--mono)'
                    }}
                  />
                  <button onClick={browseExe} style={{ padding:'6px 10px', borderRadius:6, background:'var(--surface2)', color:'var(--text)', border:'1px solid var(--border)', fontSize:11 }}>Browse</button>
                  <button onClick={saveExe} style={{ padding:'6px 12px', borderRadius:6, background:'var(--accent)', color:'#fff', fontSize:11 }}>Save</button>
                  <button onClick={() => { setExeVal(game.exe || ''); setEditingExe(false) }} style={{ padding:'6px 10px', borderRadius:6, background:'var(--surface2)', color:'var(--text)', border:'1px solid var(--border)', fontSize:11 }}>Cancel</button>
                </div>
              ) : (
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'var(--mono)', wordBreak:'break-all', flex:1 }}>
                    {game.exe}
                  </span>
                  <button onClick={() => { setExeVal(game.exe || ''); setEditingExe(true) }}
                    style={{ fontSize:11, color:'var(--text-muted)', padding:'2px 8px', borderRadius:4, background:'var(--surface2)', border:'1px solid var(--border)', flexShrink:0 }}>
                    Edit
                  </button>
                </div>
              )}
            </div>

            {/* Steam App ID */}
            <div>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.08em' }}>Steam App ID (optional)</div>
              {editingSteam ? (
                <div style={{ display:'flex', gap:8 }}>
                  <input value={steamVal} onChange={e => setSteamVal(e.target.value)}
                    autoFocus
                    placeholder="e.g. 413150 for Portal 2"
                    style={{
                      flex:1, background:'var(--surface2)', border:'1px solid var(--accent)',
                      borderRadius:6, padding:'6px 10px', color:'var(--text)', fontSize:12
                    }}
                  />
                  <button onClick={saveSteam} style={{ padding:'6px 12px', borderRadius:6, background:'var(--accent)', color:'#fff', fontSize:11 }}>Save</button>
                  <button onClick={() => { setSteamVal(game.steamAppId || ''); setEditingSteam(false) }} style={{ padding:'6px 10px', borderRadius:6, background:'var(--surface2)', color:'var(--text)', border:'1px solid var(--border)', fontSize:11 }}>Cancel</button>
                </div>
              ) : (
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:12, color: game.steamAppId ? 'var(--accent)' : 'var(--text-muted)', flex:1 }}>
                    {game.steamAppId ? `steam://run/${game.steamAppId}` : 'Not configured'}
                  </span>
                  <button onClick={() => { setSteamVal(game.steamAppId || ''); setEditingSteam(true) }}
                    style={{ fontSize:11, color:'var(--text-muted)', padding:'2px 8px', borderRadius:4, background:'var(--surface2)', border:'1px solid var(--border)', flexShrink:0 }}>
                    {game.steamAppId ? 'Edit' : 'Add'}
                  </button>
                </div>
              )}
            </div>

            {/* Launch mode */}
            <div>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.08em' }}>
                Launch Mode
              </div>
              <label style={{ display:'flex', alignItems:'center', gap:8, color:'var(--text)', fontSize:12 }}>
                <input
                  type="checkbox"
                  checked={!!game.runAsAdmin}
                  onChange={(e) => onUpdate(game.id, { runAsAdmin: e.target.checked })}
                />
                Run as administrator
              </label>
              <div style={{ marginTop:6, fontSize:11, color:'var(--text-muted)' }}>
                When enabled, playtime tracking is disabled for this game.
              </div>
            </div>

            {/* Manual artwork */}
            <div>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.08em' }}>
                Manual Artwork
              </div>

              {[
                { key: 'grid', label: 'Cover (Grid)' },
                { key: 'hero', label: 'Hero Background' },
                { key: 'logo', label: 'Logo' },
              ].map((field) => (
                <div key={field.key} style={{ marginBottom:10 }}>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>{field.label}</div>
                  <div style={{ display:'flex', gap:8 }}>
                    <input
                      value={manualArt[field.key]}
                      onChange={(e) => setManualArt(prev => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={`Paste image URL for ${field.label.toLowerCase()}...`}
                      style={{
                        flex:1,
                        background:'var(--surface2)',
                        border:'1px solid var(--border)',
                        borderRadius:6,
                        padding:'6px 10px',
                        color:'var(--text)',
                        fontSize:12,
                        fontFamily:'var(--mono)'
                      }}
                    />
                    <label style={{
                      padding:'6px 10px',
                      borderRadius:6,
                      fontSize:12,
                      background:'var(--surface2)',
                      color:'var(--text-dim)',
                      border:'1px solid var(--border)',
                      cursor:'pointer',
                      whiteSpace:'nowrap'
                    }}>
                      Upload
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => onArtFilePicked(field.key, e)}
                        style={{ display:'none' }}
                      />
                    </label>
                  </div>
                </div>
              ))}

              <div style={{ display:'flex', gap:8, marginTop:6 }}>
                <button onClick={saveManualArt} style={{
                  padding:'7px 12px', borderRadius:6, fontSize:12,
                  background:'var(--accent)', color:'#fff'
                }}>
                  Save Artwork
                </button>
                <button onClick={clearManualArt} style={{
                  padding:'7px 12px', borderRadius:6, fontSize:12,
                  background:'var(--surface2)', color:'var(--text-dim)', border:'1px solid var(--border)'
                }}>
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:2, textTransform:'uppercase', letterSpacing:'0.08em' }}>{label}</div>
      <div style={{ fontSize:14, fontWeight:500, color:'var(--text)' }}>{value}</div>
    </div>
  )
}
