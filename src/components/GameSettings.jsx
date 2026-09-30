import React, { useState, useEffect } from 'react'
import vaporApi from '../vaporApi.js'
import { sanitizeSteamAppId } from '../utils.js'
import BacklogBadge from './BacklogBadge.jsx'

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
  const [nameVal, setNameVal] = useState(game?.name || '')
  const [manualArt, setManualArt] = useState({
    grid: game?.art?.grid || '',
    hero: game?.art?.hero || '',
    logo: game?.art?.logo || '',
  })
  const [editingExe, setEditingExe] = useState(false)
  const [exeVal, setExeVal] = useState(game?.exe || '')
  const [editingSteam, setEditingSteam] = useState(false)
  const [steamVal, setSteamVal] = useState(game?.steamAppId || '')

  // Power-User Launch Controls
  const [launchArgsVal, setLaunchArgsVal] = useState(game?.launchArgs || '')
  const [workingDirVal, setWorkingDirVal] = useState(game?.workingDir || '')
  const [envVarsVal, setEnvVarsVal] = useState(Array.isArray(game?.envVars) ? game.envVars : [])
  const [preLaunchVal, setPreLaunchVal] = useState(game?.preLaunchScript || '')
  const [preLaunchWaitVal, setPreLaunchWaitVal] = useState(game?.preLaunchWait !== undefined ? !!game.preLaunchWait : true)
  const [postExitVal, setPostExitVal] = useState(game?.postExitScript || '')
  const [launchSaved, setLaunchSaved] = useState(false)

  useEffect(() => {
    setNameVal(game?.name || '')
    setExeVal(game?.exe || '')
    setSteamVal(game?.steamAppId || '')
    setLaunchArgsVal(game?.launchArgs || '')
    setWorkingDirVal(game?.workingDir || '')
    setEnvVarsVal(Array.isArray(game?.envVars) ? game.envVars : [])
    setPreLaunchVal(game?.preLaunchScript || '')
    setPreLaunchWaitVal(game?.preLaunchWait !== undefined ? !!game.preLaunchWait : true)
    setPostExitVal(game?.postExitScript || '')
    setLaunchSaved(false)
    setManualArt({
      grid: game?.art?.grid || '',
      hero: game?.art?.hero || '',
      logo: game?.art?.logo || '',
    })
    setEditingName(false)
    setEditingExe(false)
    setEditingSteam(false)
  }, [game?.id])

  useEffect(() => {
    if (!editingName) setNameVal(game?.name || '')
  }, [game?.name, editingName])

  useEffect(() => {
    if (!editingExe) setExeVal(game?.exe || '')
  }, [game?.exe, editingExe])

  useEffect(() => {
    if (!editingSteam) setSteamVal(game?.steamAppId || '')
  }, [game?.steamAppId, editingSteam])

  useEffect(() => {
    setManualArt({
      grid: game?.art?.grid || '',
      hero: game?.art?.hero || '',
      logo: game?.art?.logo || '',
    })
  }, [game?.art])

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
    const trimmed = nameVal.trim()
    if (trimmed) {
      setNameVal(trimmed)
      onUpdate(game.id, { name: trimmed })
    } else {
      setNameVal(game?.name || '')
    }
    setEditingName(false)
  }

  const saveSteam = () => {
    const id = sanitizeSteamAppId(steamVal)
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

  const saveLaunchOptions = () => {
    onUpdate(game.id, {
      launchArgs: launchArgsVal.trim(),
      workingDir: workingDirVal.trim(),
      envVars: envVarsVal.filter((v) => v && v.key && String(v.key).trim()),
      preLaunchScript: preLaunchVal.trim(),
      preLaunchWait: preLaunchWaitVal,
      postExitScript: postExitVal.trim(),
    })
    setLaunchSaved(true)
    setTimeout(() => setLaunchSaved(false), 2500)
  }

  const browseWorkingDir = async () => {
    const result = await vaporApi.dialog.folder()
    if (result) setWorkingDirVal(result)
  }

  const browsePreLaunchScript = async () => {
    const result = await vaporApi.dialog.file({
      defaultPath: workingDirVal || game.folder,
      filters: [
        { name: 'Scripts & Executables', extensions: ['bat', 'cmd', 'ps1', 'exe'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })
    if (result) setPreLaunchVal(result)
  }

  const browsePostExitScript = async () => {
    const result = await vaporApi.dialog.file({
      defaultPath: workingDirVal || game.folder,
      filters: [
        { name: 'Scripts & Executables', extensions: ['bat', 'cmd', 'ps1', 'exe'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })
    if (result) setPostExitVal(result)
  }

  const appendArgPreset = (flag) => {
    const current = launchArgsVal.trim()
    if (!current) {
      setLaunchArgsVal(flag)
    } else if (!current.includes(flag)) {
      setLaunchArgsVal(`${current} ${flag}`)
    }
  }

  const addEnvVar = (key = '', value = '') => {
    setEnvVarsVal((prev) => [...prev, { key, value }])
  }

  const updateEnvVar = (index, field, val) => {
    setEnvVarsVal((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: val }
      return next
    })
  }

  const removeEnvVar = (index) => {
    setEnvVarsVal((prev) => prev.filter((_, i) => i !== index))
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
            <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.08em' }}>Completion Status</div>
            <BacklogBadge
              status={game?.status}
              editable={true}
              size="md"
              onChange={(newStatus) => onUpdate(game.id, { status: newStatus })}
            />
          </div>

          <div>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.08em' }}>Game Name</div>
            {editingName ? (
              <div style={{ display:'flex', gap:8 }}>
                <input value={nameVal} onChange={e => setNameVal(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveName()
                    if (e.key === 'Escape') {
                      setNameVal(game?.name || '')
                      setEditingName(false)
                    }
                  }}
                  autoFocus
                  style={{ flex:1, background:'var(--surface2)', border:'1px solid var(--accent)', borderRadius:6, padding:'6px 10px', color:'var(--text)', fontSize:14 }}
                />
                <button onClick={saveName} className="btn-accent" style={{ padding:'6px 12px', borderRadius:6, fontSize:12 }}>Save</button>
              </div>
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:16, fontWeight:500 }}>{game.name}</span>
                <button onClick={() => { setNameVal(game?.name || ''); setEditingName(true) }}
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
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveExe()
                    if (e.key === 'Escape') {
                      setExeVal(game?.exe || '')
                      setEditingExe(false)
                    }
                  }}
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
                <button onClick={() => { setExeVal(game?.exe || ''); setEditingExe(true) }}
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
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveSteam()
                    if (e.key === 'Escape') {
                      setSteamVal(game?.steamAppId || '')
                      setEditingSteam(false)
                    }
                  }}
                  style={{ flex:1, background:'var(--surface2)', border:'1px solid var(--accent)', borderRadius:6, padding:'6px 10px', color:'var(--text)', fontSize:12 }}
                />
                <button onClick={saveSteam} className="btn-accent" style={{ padding:'6px 12px', borderRadius:6, fontSize:11 }}>Save</button>
              </div>
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:12, color: game.steamAppId ? 'var(--accent)' : 'var(--text-muted)', flex:1 }}>
                  {game.steamAppId ? `steam://run/${game.steamAppId}` : 'Not configured'}
                </span>
                <button onClick={() => { setSteamVal(game?.steamAppId || ''); setEditingSteam(true) }}
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
            <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.08em' }}>Launch Mode & Category</div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>
                <div>
                  <div style={{ fontSize:13, color:'var(--text)' }}>Virtual Reality (VR) Game</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)' }}>Displays game in the VR category and tags it with 🥽 VR</div>
                </div>
                <button role="switch" aria-checked={!!game.isVR}
                  onClick={() => {
                    const nextVR = !game.isVR
                    let nextGenres = Array.isArray(game.genres) ? [...game.genres] : []
                    if (nextVR && !nextGenres.some(g => String(g).toLowerCase() === 'vr')) {
                      nextGenres.push('VR')
                    } else if (!nextVR) {
                      nextGenres = nextGenres.filter(g => String(g).toLowerCase() !== 'vr')
                    }
                    onUpdate(game.id, { isVR: nextVR, genres: nextGenres })
                  }}
                  style={{
                    width:44, height:24, borderRadius:12, padding:2, border:'none', cursor:'pointer',
                    background: game.isVR ? 'var(--accent)' : 'var(--surface2)',
                    transition:'background 0.2s ease', flexShrink:0,
                  }}>
                  <div style={{
                    width:20, height:20, borderRadius:'50%', background:'#fff',
                    transition:'transform 0.2s ease',
                    transform: game.isVR ? 'translateX(20px)' : 'translateX(0)',
                    boxShadow:'0 1px 3px rgba(0,0,0,0.3)',
                  }} />
                </button>
              </div>

              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>
                <div>
                  <div style={{ fontSize:13, color:'var(--text)' }}>Run as administrator</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)' }}>Request elevated privileges on launch</div>
                </div>
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
          </div>

          <div>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.08em', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span>Launch Options & Power-User Controls</span>
              {launchSaved && (
                <span style={{ color:'var(--green, #22c55e)', fontSize:11, fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                  ✓ Saved successfully
                </span>
              )}
            </div>

            <div style={{
              background:'var(--surface2)',
              border:'1px solid var(--border)',
              borderRadius:8,
              padding:16,
              display:'flex',
              flexDirection:'column',
              gap:18,
            }}>
              {/* Command Line Arguments */}
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:'var(--text)', marginBottom:2 }}>Command Line Arguments</div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:8 }}>
                  Flags passed directly to the game binary on startup.
                </div>
                <input
                  value={launchArgsVal}
                  onChange={(e) => setLaunchArgsVal(e.target.value)}
                  placeholder="e.g. -novid -fullscreen -dx11 +fps_max 60"
                  style={{
                    width:'100%',
                    background:'var(--surface)',
                    border:'1px solid var(--border)',
                    borderRadius:6,
                    padding:'8px 10px',
                    color:'var(--text)',
                    fontSize:12,
                    fontFamily:'var(--mono)',
                  }}
                />
                <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginTop:8 }}>
                  <span style={{ fontSize:11, color:'var(--text-muted)' }}>Quick Presets:</span>
                  {[
                    { label: '+novid', val: '-novid' },
                    { label: 'Fullscreen', val: '-fullscreen' },
                    { label: 'Windowed', val: '-windowed' },
                    { label: 'DirectX 11', val: '-dx11' },
                    { label: 'Vulkan', val: '-vulkan' },
                    { label: 'Max 60 FPS', val: '+fps_max 60' },
                    { label: 'High Priority', val: '-high' },
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => appendArgPreset(preset.val)}
                      style={{
                        fontSize:11,
                        padding:'3px 8px',
                        borderRadius:4,
                        background:'var(--surface)',
                        border:'1px solid var(--border)',
                        color:'var(--text-dim)',
                        cursor:'pointer',
                        fontFamily:'var(--mono)',
                      }}
                    >
                      +{preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Working Directory Override */}
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:'var(--text)', marginBottom:2 }}>Working Directory Override</div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:8 }}>
                  Specifies where the game executable executes from. Defaults to the game's folder.
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <input
                    value={workingDirVal}
                    onChange={(e) => setWorkingDirVal(e.target.value)}
                    placeholder={`Default: ${game.folder || 'Game directory'}`}
                    style={{
                      flex:1,
                      background:'var(--surface)',
                      border:'1px solid var(--border)',
                      borderRadius:6,
                      padding:'8px 10px',
                      color:'var(--text)',
                      fontSize:12,
                      fontFamily:'var(--mono)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={browseWorkingDir}
                    style={{
                      padding:'8px 12px',
                      borderRadius:6,
                      background:'var(--surface)',
                      color:'var(--text)',
                      border:'1px solid var(--border)',
                      fontSize:11,
                      cursor:'pointer',
                      whiteSpace:'nowrap',
                    }}
                  >
                    Browse...
                  </button>
                  {workingDirVal && (
                    <button
                      type="button"
                      onClick={() => setWorkingDirVal('')}
                      style={{
                        padding:'8px 10px',
                        borderRadius:6,
                        background:'transparent',
                        color:'var(--text-muted)',
                        border:'1px solid var(--border)',
                        fontSize:11,
                        cursor:'pointer',
                      }}
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Custom Environment Variables */}
              <div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:2 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>Custom Environment Variables</div>
                  <button
                    type="button"
                    onClick={() => addEnvVar()}
                    style={{
                      fontSize:11,
                      color:'var(--accent)',
                      background:'transparent',
                      border:'none',
                      cursor:'pointer',
                      fontWeight:600,
                    }}
                  >
                    + Add Variable
                  </button>
                </div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:8 }}>
                  Environment variables applied to the game process on launch.
                </div>

                {envVarsVal.length > 0 ? (
                  <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:8 }}>
                    {envVarsVal.map((envItem, idx) => (
                      <div key={idx} style={{ display:'flex', gap:6, alignItems:'center' }}>
                        <input
                          value={envItem.key}
                          onChange={(e) => updateEnvVar(idx, 'key', e.target.value)}
                          placeholder="VARIABLE_NAME"
                          style={{
                            flex:1,
                            background:'var(--surface)',
                            border:'1px solid var(--border)',
                            borderRadius:4,
                            padding:'6px 8px',
                            color:'var(--text)',
                            fontSize:11,
                            fontFamily:'var(--mono)',
                          }}
                        />
                        <span style={{ color:'var(--text-muted)', fontSize:12 }}>=</span>
                        <input
                          value={envItem.value}
                          onChange={(e) => updateEnvVar(idx, 'value', e.target.value)}
                          placeholder="value"
                          style={{
                            flex:1.2,
                            background:'var(--surface)',
                            border:'1px solid var(--border)',
                            borderRadius:4,
                            padding:'6px 8px',
                            color:'var(--text)',
                            fontSize:11,
                            fontFamily:'var(--mono)',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => removeEnvVar(idx)}
                          style={{
                            padding:'6px 8px',
                            borderRadius:4,
                            background:'transparent',
                            color:'var(--red, #ef4444)',
                            border:'1px solid transparent',
                            cursor:'pointer',
                            fontSize:12,
                          }}
                          title="Remove variable"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize:11, color:'var(--text-muted)', fontStyle:'italic', marginBottom:8 }}>
                    No environment variables set.
                  </div>
                )}

                <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                  <span style={{ fontSize:11, color:'var(--text-muted)' }}>Common Presets:</span>
                  {[
                    { key: 'PROTON_ENABLE_NVAPI', val: '1', label: 'Proton DLSS' },
                    { key: 'DXVK_HUD', val: 'fps', label: 'DXVK FPS HUD' },
                    { key: 'MALLOC_ARENA_MAX', val: '2', label: 'Memory Fix' },
                    { key: 'WINE_FULLSCREEN_FSR', val: '1', label: 'Wine FSR' },
                  ].map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => {
                        if (!envVarsVal.some((item) => item.key === preset.key)) {
                          addEnvVar(preset.key, preset.val)
                        }
                      }}
                      style={{
                        fontSize:11,
                        padding:'3px 8px',
                        borderRadius:4,
                        background:'var(--surface)',
                        border:'1px solid var(--border)',
                        color:'var(--text-dim)',
                        cursor:'pointer',
                      }}
                    >
                      +{preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pre-Launch Script */}
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:'var(--text)', marginBottom:2 }}>Pre-Launch Script / Hook</div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:8 }}>
                  Script or executable (.bat, .cmd, .ps1, .exe) executed before the game starts (e.g. controller remapper, resolution switch, mounts).
                </div>
                <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                  <input
                    value={preLaunchVal}
                    onChange={(e) => setPreLaunchVal(e.target.value)}
                    placeholder="Path to .bat, .cmd, .ps1 or command line..."
                    style={{
                      flex:1,
                      background:'var(--surface)',
                      border:'1px solid var(--border)',
                      borderRadius:6,
                      padding:'8px 10px',
                      color:'var(--text)',
                      fontSize:12,
                      fontFamily:'var(--mono)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={browsePreLaunchScript}
                    style={{
                      padding:'8px 12px',
                      borderRadius:6,
                      background:'var(--surface)',
                      color:'var(--text)',
                      border:'1px solid var(--border)',
                      fontSize:11,
                      cursor:'pointer',
                      whiteSpace:'nowrap',
                    }}
                  >
                    Browse...
                  </button>
                </div>
                <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
                  <input
                    type="checkbox"
                    checked={preLaunchWaitVal}
                    onChange={(e) => setPreLaunchWaitVal(e.target.checked)}
                    style={{ cursor:'pointer' }}
                  />
                  <span style={{ fontSize:11, color:'var(--text-dim)' }}>
                    Wait for pre-launch script to complete before starting game
                  </span>
                </label>
              </div>

              {/* Post-Exit Script */}
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:'var(--text)', marginBottom:2 }}>Post-Exit Script / Hook</div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:8 }}>
                  Script executed immediately after the game session ends (e.g. save backup, cleanup, restoring background apps).
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <input
                    value={postExitVal}
                    onChange={(e) => setPostExitVal(e.target.value)}
                    placeholder="Path to .bat, .cmd, .ps1 or command line..."
                    style={{
                      flex:1,
                      background:'var(--surface)',
                      border:'1px solid var(--border)',
                      borderRadius:6,
                      padding:'8px 10px',
                      color:'var(--text)',
                      fontSize:12,
                      fontFamily:'var(--mono)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={browsePostExitScript}
                    style={{
                      padding:'8px 12px',
                      borderRadius:6,
                      background:'var(--surface)',
                      color:'var(--text)',
                      border:'1px solid var(--border)',
                      fontSize:11,
                      cursor:'pointer',
                      whiteSpace:'nowrap',
                    }}
                  >
                    Browse...
                  </button>
                </div>
              </div>

              <div style={{ display:'flex', justifyContent:'flex-end', paddingTop:6, borderTop:'1px solid var(--border)' }}>
                <button
                  type="button"
                  onClick={saveLaunchOptions}
                  className="btn-accent"
                  style={{
                    padding:'8px 18px',
                    borderRadius:6,
                    fontSize:12,
                    fontWeight:600,
                    display:'flex',
                    alignItems:'center',
                    gap:6,
                  }}
                >
                  {launchSaved ? '✓ Options Saved' : 'Save Launch Options'}
                </button>
              </div>
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
