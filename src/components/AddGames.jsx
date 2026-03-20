import React, { useState } from 'react'
import vaporApi from '../vaporApi.js'

export default function AddGames({ settings, existingGames, onAdd, onDone }) {
  const [scanning, setScanning]   = useState(false)
  const [results, setResults]     = useState([])
  const [selected, setSelected]   = useState(new Set())
  const [fetchingArt, setFetchingArt] = useState(false)
  const [artProgress, setArtProgress] = useState({ done:0, total:0 })

  const pickAndScan = async () => {
    const folder = await vaporApi.dialog.folder()
    if (!folder) return
    setScanning(true)
    const found = await vaporApi.folder.scan(folder)
    const existing = new Set(existingGames.map(g => g.exe))
    const fresh = found.filter(f => !existing.has(f.exe))
    setResults(fresh)
    setSelected(new Set(fresh.map(f => f.exe)))
    setScanning(false)
  }

  const toggle = (exe) => {
    setSelected(s => {
      const n = new Set(s)
      n.has(exe) ? n.delete(exe) : n.add(exe)
      return n
    })
  }

  const confirm = async () => {
    const chosen = results.filter(r => selected.has(r.exe))
    if (!chosen.length) { onDone(); return }
    setFetchingArt(true)
    setArtProgress({ done:0, total: chosen.length })
    const withArt = []
    for (let i = 0; i < chosen.length; i++) {
      const g = chosen[i]
      const art = await vaporApi.art.fetch(g.name)
      withArt.push({ ...g, art: art || null, genres: art?.genres || [] })
      setArtProgress({ done: i+1, total: chosen.length })
    }
    setFetchingArt(false)
    onAdd(withArt)
    onDone()
  }

  return (
    <div style={{ height:'100%', overflow:'auto', padding:'28px 28px' }}>
      <h2 style={{ fontSize:18, fontWeight:600, marginBottom:4 }}>Add Games</h2>
      <p style={{ color:'var(--text-muted)', fontSize:13, marginBottom:24 }}>
        Choose a folder to scan for games. Vapor will detect .exe files automatically.
      </p>

      <div style={{ display:'flex', gap:10, marginBottom:24 }}>
        <button onClick={pickAndScan} disabled={scanning} style={{
          padding:'9px 20px', borderRadius:6, fontSize:13, fontWeight:500,
          background:'var(--accent)', color:'#fff'
        }}>
          {scanning ? 'Scanning...' : '📁 Choose Folder'}
        </button>
        {results.length > 0 && (
          <button onClick={() => { setResults([]); setSelected(new Set()) }} style={{
            padding:'9px 16px', borderRadius:6, fontSize:13,
            background:'var(--surface2)', color:'var(--text-dim)',
            border:'1px solid var(--border)'
          }}>Clear</button>
        )}
      </div>

      {fetchingArt && (
        <div style={{ marginBottom:20, padding:16, borderRadius:8, background:'var(--surface)', border:'1px solid var(--border)' }}>
          <div style={{ fontSize:13, color:'var(--text-dim)', marginBottom:8 }}>
            Fetching artwork... {artProgress.done}/{artProgress.total}
          </div>
          <div style={{ height:4, background:'var(--surface2)', borderRadius:2, overflow:'hidden' }}>
            <div style={{
              height:'100%', background:'var(--accent)', borderRadius:2,
              width: `${(artProgress.done / artProgress.total) * 100}%`,
              transition:'width 0.2s'
            }} />
          </div>
        </div>
      )}

      {results.length > 0 && !fetchingArt && (
        <>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <span style={{ fontSize:13, color:'var(--text-muted)' }}>
              Found {results.length} game{results.length!==1?'s':''} · {selected.size} selected
            </span>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setSelected(new Set(results.map(r=>r.exe)))} style={{
                fontSize:12, color:'var(--accent)', background:'none'
              }}>Select All</button>
              <button onClick={() => setSelected(new Set())} style={{
                fontSize:12, color:'var(--text-muted)', background:'none'
              }}>None</button>
            </div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:20 }}>
            {results.map(r => (
              <div key={r.exe} onClick={() => toggle(r.exe)} style={{
                display:'flex', alignItems:'center', gap:12, padding:'10px 12px',
                borderRadius:6, cursor:'pointer',
                background: selected.has(r.exe) ? 'var(--accent-dim)' : 'var(--surface)',
                border:'1px solid ' + (selected.has(r.exe) ? '#6c63ff40' : 'var(--border)'),
                transition:'all 0.12s'
              }}>
                <div style={{
                  width:16, height:16, borderRadius:4, flexShrink:0,
                  background: selected.has(r.exe) ? 'var(--accent)' : 'var(--surface2)',
                  border:'1px solid ' + (selected.has(r.exe) ? 'var(--accent)' : 'var(--border2)'),
                  display:'flex', alignItems:'center', justifyContent:'center'
                }}>
                  {selected.has(r.exe) && <span style={{ color:'#fff', fontSize:10 }}>✓</span>}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:500 }}>{r.name}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'var(--mono)', marginTop:1 }}>{r.exeName}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display:'flex', gap:10 }}>
            <button onClick={confirm} disabled={selected.size === 0} style={{
              padding:'10px 24px', borderRadius:6, fontSize:13, fontWeight:600,
              background: selected.size > 0 ? 'var(--accent)' : 'var(--surface2)',
              color: selected.size > 0 ? '#fff' : 'var(--text-muted)'
            }}>
              Add {selected.size} Game{selected.size!==1?'s':''}
            </button>
            <button onClick={onDone} style={{
              padding:'10px 16px', borderRadius:6, fontSize:13,
              background:'var(--surface2)', color:'var(--text-dim)',
              border:'1px solid var(--border)'
            }}>Cancel</button>
          </div>
        </>
      )}
    </div>
  )
}
