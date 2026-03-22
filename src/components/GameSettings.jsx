import React, { useState } from 'react'
import vaporApi from '../vaporApi.js'

export default function GameSettings({
  game,
  collections,
  onBack,
  onUpdate,
  onRemove,
  onToggleFavorite,
  onToggleCollection,
}) {
  const [editingName, setEditingName] = useState(false)
  const [nameVal, setNameVal] = useState(game.name)
  const [manualArt, setManualArt] = useState({
    grid: game.art?.grid || '',
    hero: game.art?.hero || '',
    logo: game.art?.logo || '',
  })
  const [editingExe, setEditingExe] = useState(false)
  const [exeVal, setExeVal] = useState(game.exe || '')
  const [editingSteam, setEditingSteam] = useState(false)
  const [steamVal, setSteamVal] = useState(game.steamAppId || '')

  const browseExe = async () => {
    const result = await vaporApi.dialog.file({ defaultPath: game.folder })
    if (result) setExeVal(result)
  }

  const saveExe = () => {
    const path = exeVal.trim()
    if (path && path !== game.exe) {
      onUpdate(game.id, { exe: path, exeName: path.split(/[\\/]/).pop() })
    }
    setEditingExe(false)
  }

  const saveName = () => {
    if (nameVal.trim()) onUpdate(game.id, { name: nameVal.trim() })
    setEditingName(false)
  }

  const saveSteam = () => {
    const id = steamVal.trim()
    onUpdate(game.id, { steamAppId: id || null })
    setEditingSteam(false)
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
      <div style={{ position:'relative', height:180, overflow:'hidden', background:'var(--surface)' }}>
        {game.art?.hero ? (
          <img src={game.art.hero} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block', opacity:0.4 }} />
        ) : (
          <div style={{ width:'100%', height:'100%', background:'linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%)' }} />
        )}
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom, transparent 30%, var(--bg) 100%)' }} />

        <button onClick={onBack} style={{
          position:'absolute', top:16, left:16, display:'flex', alignItems:'center', gap:6,
          color:'#fff', fontSize:13, opacity:0.8,
          background:'#00000040', padding:'6px 12px', borderRadius:6,
          backdropFilter:'blur(4px)'
        }}>
          Back
        </button>

        <div style={{ position:'absolute', bottom:16, left:20, right:20, display:'flex', alignItems:'center', gap:12 }}>
          {game.art?.grid && (
            <img src={game.art.grid} alt="" style={{ width:50, height:75, objectFit:'cover', borderRadius:4, border:'1px solid var(--border2)' }} />
          )}
          <h2 style={{ fontSize:20, fontWeight:600, color:'#fff', textShadow:'0 2px 8px #000' }}>{game.name}</h2>
        </div>
      </div>

      <div style={{ padding:'20px 24px 32px' }}>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
          <button onClick={() => onToggleFavorite(game.id)} style={{
            padding:'8px 14px', borderRadius:6, fontSize:12,
            background: game.favorite ? '#f59e0b22' : 'var(--surface2)',
            color: game.favorite ? '#f59e0b' : 'var(--text-dim)',
            border:'1px solid ' + (game.favorite ? '#f59e0b55' : 'var(--border)'),
          }}>
            {game.favorite ? '★ Favorited' : '☆ Favorite'}
          </button>

          <button onClick={() => onRemove(game.id)} style={{
            padding:'8px 14px', borderRadius:6, fontSize:12,
            background:'transparent', color:'var(--red)',
            border:'1px solid #f8717130'
          }}>
            Remove
          </button>
        </div>

        <div style={{ marginTop:20, display:'flex', flexDirection:'column', gap:20 }}>
          <div>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.08em' }}>Game Name</div>
            {editingName ? (
              <div style={{ display:'flex', gap:8 }}>
                <input value={nameVal} onChange={e => setNameVal(e.target.value)}
                  onKeyDown={e => { if(e.key==='Enter') saveName(); if(e.key==='Escape') setEditingName(false) }}
                  autoFocus
                  style={{ flex:1, background:'var(--surface2)', border:'1px solid var(--accent)', borderRadius:6, padding:'6px 10px', color:'var(--text)', fontSize:14 }}
                />
                <button onClick={saveName} className="btn-accent" style={{ padding:'6px 12px', borderRadius:6, fontSize:12 }}>Save</button>
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

          <div>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.08em' }}>Executable</div>
            {editingExe ? (
              <div style={{ display:'flex', gap:8 }}>
                <input value={exeVal} onChange={e => setExeVal(e.target.value)} autoFocus
                  style={{ flex:1, background:'var(--surface2)', border:'1px solid var(--accent)', borderRadius:6, padding:'6px 10px', color:'var(--text)', fontSize:11, fontFamily:'var(--mono)' }}
                />
                <button onClick={browseExe} style={{ padding:'6px 10px', borderRadius:6, background:'var(--surface2)', color:'var(--text)', border:'1px solid var(--border)', fontSize:11 }}>Browse</button>
                <button onClick={saveExe} className="btn-accent" style={{ padding:'6px 12px', borderRadius:6, fontSize:11 }}>Save</button>
              </div>
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'var(--mono)', wordBreak:'break-all', flex:1 }}>
                  {game.exe || 'No executable set'}
                </span>
                <button onClick={() => { setExeVal(game.exe || ''); setEditingExe(true) }}
                  style={{ fontSize:11, color:'var(--text-muted)', padding:'2px 8px', borderRadius:4, background:'var(--surface2)', border:'1px solid var(--border)', flexShrink:0 }}>
                  Edit
                </button>
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.08em' }}>Steam App ID</div>
            {editingSteam ? (
              <div style={{ display:'flex', gap:8 }}>
                <input value={steamVal} onChange={e => setSteamVal(e.target.value)} autoFocus placeholder="e.g. 413150"
                  style={{ flex:1, background:'var(--surface2)', border:'1px solid var(--accent)', borderRadius:6, padding:'6px 10px', color:'var(--text)', fontSize:12 }}
                />
                <button onClick={saveSteam} className="btn-accent" style={{ padding:'6px 12px', borderRadius:6, fontSize:11 }}>Save</button>
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

          {collections?.length > 0 && (
            <div>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.08em' }}>Collections</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {collections.map(c => {
                  const inCollection = (game.collections || []).includes(c.id)
                  return (
                    <button key={c.id} onClick={() => onToggleCollection(game.id, c.id)}
                      style={{
                        fontSize:11, padding:'4px 10px', borderRadius:20,
                        background: inCollection ? 'var(--accent-dim)' : 'var(--surface2)',
                        border:'1px solid ' + (inCollection ? '#6c63ff55' : 'var(--border)'),
                        color: inCollection ? 'var(--accent)' : 'var(--text-dim)',
                      }}>
                      {inCollection ? '✓ ' : ''}{c.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.08em' }}>Launch Mode</div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>
              <div style={{ fontSize:13, color:'var(--text)' }}>Run as administrator</div>
              <button role="switch" aria-checked={!!game.runAsAdmin}
                onClick={() => onUpdate(game.id, { runAsAdmin: !game.runAsAdmin })}
                style={{
                  width:44, height:24, borderRadius:12, padding:2, border:'none', cursor:'pointer',
                  background: game.runAsAdmin ? 'var(--accent)' : 'var(--surface2)',
                  transition:'background 0.2s ease', flexShrink:0,
                }}>
                <div style={{
                  width:20, height:20, borderRadius:'50%', background:'#fff',
                  transition:'transform 0.2s ease',
                  transform: game.runAsAdmin ? 'translateX(20px)' : 'translateX(0)',
                  boxShadow:'0 1px 3px rgba(0,0,0,0.3)',
                }} />
              </button>
            </div>
          </div>

          <div>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.08em' }}>Manual Artwork</div>
            {[
              { key: 'grid', label: 'Cover (Grid)' },
              { key: 'hero', label: 'Hero Background' },
              { key: 'logo', label: 'Logo' },
            ].map((field) => (
              <div key={field.key} style={{ marginBottom:10 }}>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>{field.label}</div>
                <div style={{ display:'flex', gap:8 }}>
                  <input value={manualArt[field.key]}
                    onChange={(e) => setManualArt(prev => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder="Paste image URL..."
                    style={{ flex:1, background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:6, padding:'6px 10px', color:'var(--text)', fontSize:12, fontFamily:'var(--mono)' }}
                  />
                  <label style={{ padding:'6px 10px', borderRadius:6, fontSize:12, background:'var(--surface2)', color:'var(--text-dim)', border:'1px solid var(--border)', cursor:'pointer', whiteSpace:'nowrap' }}>
                    Upload
                    <input type="file" accept="image/*" onChange={(e) => onArtFilePicked(field.key, e)} style={{ display:'none' }} />
                  </label>
                </div>
              </div>
            ))}
            <div style={{ display:'flex', gap:8, marginTop:6 }}>
              <button onClick={saveManualArt} className="btn-accent" style={{ padding:'7px 12px', borderRadius:6, fontSize:12 }}>Save</button>
              <button onClick={clearManualArt} style={{ padding:'7px 12px', borderRadius:6, fontSize:12, background:'var(--surface2)', color:'var(--text-dim)', border:'1px solid var(--border)' }}>Clear</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
