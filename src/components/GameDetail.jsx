import React, { useEffect, useState } from 'react'
import vaporApi from '../vaporApi.js'
import { formatFileSize, sanitizeSteamAppId } from '../utils.js'
import { Button, Text, Badge, Flex, Stat, Divider, spacing, radius, shadows, typography } from './UIKit.jsx'
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
  const [artError, setArtError] = useState('')
  const [logoFailed, setLogoFailed] = useState(false)
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
    setLogoFailed(false)
  }, [game])

  const fetchArt = async (retry = false) => {
    setFetchingArt(true)
    setArtError('')
    try {
      const art = await vaporApi.art.fetch(game.name)
      if (art?.error) {
        setArtError(art.error === 'no-api-key' ? 'No SteamGridDB key bundled. Set SGDB_API_KEY before build and rebuild.' : 
                    art.error === 'not-found' ? 'Game not found on SteamGridDB' : 
                    art.error)
      } else if (art && (art.grid || art.hero || art.logo)) {
        onUpdate(game.id, { art })
      } else if (!retry) {
        setTimeout(() => fetchArt(true), 1000)
      } else {
        setArtError('No artwork found')
      }
    } catch (err) {
      setArtError(err.message || 'Failed to fetch art')
    }
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
    const id = sanitizeSteamAppId(steamVal)
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
      {/* Hero section with gradient overlay */}
      <div style={{
        position:'relative',
        height: '320px',
        overflow:'hidden',
        background: game.art?.hero 
          ? 'transparent'
          : 'linear-gradient(135deg, var(--surface2) 0%, var(--surface3) 50%, var(--surface2) 100%)',
      }}>
        {game.art?.hero && (
          <img src={game.art.hero} alt="" style={{
            width:'100%',
            height:'100%',
            objectFit:'cover',
            display:'block',
            opacity: 0.5,
            filter: 'brightness(0.8)',
          }} />
        )}
        <div style={{
          position:'absolute',
          inset:0,
          background: 'linear-gradient(to bottom, transparent 30%, var(--bg) 100%)',
          pointerEvents: 'none',
        }} />

        {/* Back button */}
        <Button
          variant="ghost"
          size="md"
          onClick={onBack}
          style={{
            position:'absolute',
            top: spacing.lg,
            left: spacing.lg,
            color:'#fff',
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.2)',
            zIndex: 10,
          }}
        >
          ← Back
        </Button>

        {/* Cover & title overlay */}
        <div style={{
          position:'absolute',
          bottom: spacing.xxl,
          left: spacing.xxl,
          right: spacing.xxl,
          display:'flex',
          alignItems:'flex-end',
          gap: spacing.xl,
        }}>
          {game.art?.grid && (
            <img src={game.art.grid} alt="" style={{
              width: 100,
              height: 150,
              objectFit:'cover',
              borderRadius: radius.lg,
              boxShadow: shadows.xl,
              flexShrink:0,
              border:`2px solid var(--border2)`,
            }} />
          )}
          <div style={{ flex:1 }}>
            {game.art?.logo && !logoFailed && (
              <img
                src={game.art.logo}
                alt={game.name}
                style={{
                  maxHeight: 90,
                  maxWidth: 380,
                  objectFit:'contain',
                  filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.5))',
                  marginBottom: spacing.sm,
                }}
                onError={() => setLogoFailed(true)}
              />
            )}
            <h1 style={{
              ...typography.h1,
              color:'#fff',
              textShadow: '0 4px 20px rgba(0,0,0,0.7)',
              display: game.art?.logo && !logoFailed ? 'none' : 'block',
            }}>
              {game.name}
            </h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: `${spacing.xxl} ${spacing.xxl} ${spacing.xxxl}`, maxWidth: '1200px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'240px 1fr', gap: spacing.xxxl, alignItems:'flex-start' }}>
          {/* Left sidebar - Actions */}
          <div style={{ display:'flex', flexDirection:'column', gap: spacing.lg }}>
            <Button
              variant={running ? 'success' : 'primary'}
              size="lg"
              onClick={() => onLaunch(game)}
              disabled={running}
              style={{ width: '100%' }}
            >
              {running ? '● Running' : '▶ Play Now'}
            </Button>

            <Button
              variant="secondary"
              size="md"
              onClick={() => onOpenSettings && onOpenSettings(game)}
              style={{ width: '100%' }}
            >
              ⚙ Settings
            </Button>

            <Button
              variant="secondary"
              size="md"
              onClick={fetchArt}
              disabled={fetchingArt}
              style={{ width: '100%' }}
            >
              🎨 {fetchingArt ? 'Fetching...' : 'Fetch Art'}
            </Button>

            {artError && (
              <div style={{ fontSize:'11px', color:'var(--red)', padding: `${spacing.sm} ${spacing.md}`, background: 'color-mix(in srgb, var(--red) 10%, transparent)', borderRadius: radius.md, border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)' }}>
                {artError}
              </div>
            )}

            <Button
              variant={game.favorite ? 'primary' : 'secondary'}
              size="md"
              onClick={() => onToggleFavorite(game.id)}
              style={{ width: '100%' }}
            >
              {game.favorite ? '★ Favorited' : '☆ Add to Favorites'}
            </Button>

            <Divider />

            <Button
              variant="danger"
              size="md"
              onClick={() => onRemove(game.id)}
              style={{ width: '100%' }}
            >
              🗑 Remove
            </Button>
          </div>

          {/* Right - metadata */}
          <div style={{ display:'flex', flexDirection:'column', gap: spacing.lg }}>
            {/* Stats */}
            <div
              style={{
                background:'var(--surface2)',
                border:'1px solid var(--border)',
                borderRadius: radius.lg,
                padding: spacing.lg,
              }}
            >
              <div style={{ display:'flex', gap: spacing.xxxl, flexWrap:'wrap' }}>
                <Stat label="Playtime" value={fmtTime(game.playtime)} icon={<ClockIcon />} />
                <Stat label="Last Played" value={fmtDate(game.lastPlayed)} icon={<CalendarIcon />} />
                <Stat label="File Size" value={formatFileSize(game.fileSize)} icon={<DriveIcon />} />
                {game.art?.sgdbName && game.art.sgdbName !== game.name && (
                  <Stat label="Matched As" value={game.art.sgdbName} icon={<LinkIcon />} />
                )}
              </div>
            </div>

            {/* Genres */}
            {game.genres?.length > 0 && (
              <div
                style={{
                  background:'var(--surface2)',
                  border:'1px solid var(--border)',
                  borderRadius: radius.lg,
                  padding: spacing.lg,
                }}
              >
                <Text.Caption style={{ display: 'block', marginBottom: spacing.md }}>Genres</Text.Caption>
                <Flex gap={spacing.sm} wrap="wrap">
                  {game.genres.map(g => (
                    <Badge key={g} variant="accent">{g}</Badge>
                  ))}
                </Flex>
              </div>
            )}

            {/* Executable */}
            <div
              style={{
                background:'var(--surface2)',
                border:'1px solid var(--border)',
                borderRadius: radius.lg,
                padding: spacing.lg,
              }}
            >
              <Text.Caption style={{ display: 'block', marginBottom: spacing.md }}>Executable</Text.Caption>
              {editingExe ? (
                <Flex gap={spacing.md} style={{ marginBottom: spacing.md }}>
                  <input
                    value={exeVal}
                    onChange={e => setExeVal(e.target.value)}
                    onKeyDown={e => { if(e.key==='Enter') saveExe(); if(e.key==='Escape') setEditingExe(false) }}
                    autoFocus
                    className="gd-input ui-input"
                    style={{ flex:1 }}
                  />
                  <Button variant="secondary" size="sm" onClick={browseExe}>Browse</Button>
                  <Button variant="primary" size="sm" onClick={saveExe}>Save</Button>
                </Flex>
              ) : (
                <Flex gap={spacing.md} style={{ marginBottom: spacing.md }}>
                  <Text.Caption mono style={{ flex: 1, wordBreak:'break-all', color: 'var(--text-muted)' }}>
                    {game.exe || 'No executable set'}
                  </Text.Caption>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setExeVal(game.exe || ''); setEditingExe(true) }}
                  >
                    Edit
                  </Button>
                </Flex>
              )}

              <Divider />

              <Flex justify="space-between" align="center">
                <Text.Body>Run as administrator</Text.Body>
                <button
                  role="switch"
                  aria-checked={!!game.runAsAdmin}
                  onClick={() => onUpdate(game.id, { runAsAdmin: !game.runAsAdmin })}
                  style={{
                    width: 44,
                    height: 24,
                    borderRadius: 12,
                    padding: 2,
                    border: 'none',
                    cursor: 'pointer',
                    background: game.runAsAdmin ? 'var(--accent)' : 'var(--surface)',
                    transition: `background ${spacing.md}`,
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: '#fff',
                      transition: `transform ${spacing.md}`,
                      transform: game.runAsAdmin ? 'translateX(20px)' : 'translateX(0)',
                      boxShadow: shadows.sm,
                    }}
                  />
                </button>
              </Flex>
            </div>

            {/* Collections */}
            {collections?.length > 0 && (
              <div
                style={{
                  background:'var(--surface2)',
                  border:'1px solid var(--border)',
                  borderRadius: radius.lg,
                  padding: spacing.lg,
                }}
              >
                <Text.Caption style={{ display: 'block', marginBottom: spacing.md }}>Collections</Text.Caption>
                <Flex gap={spacing.sm} wrap="wrap">
                  {collections.map(c => {
                    const inCollection = (game.collections || []).includes(c.id)
                    return (
                      <Button
                        key={c.id}
                        variant={inCollection ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => onToggleCollection(game.id, c.id)}
                      >
                        {inCollection ? '✓ ' : '+ '}{c.name}
                      </Button>
                    )
                  })}
                </Flex>
              </div>
            )}


          </div>
        </div>
      </div>
    </div>
  )
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6l3 2" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </svg>
  )
}

function DriveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7h18" />
      <path d="M5 7l2-3h10l2 3" />
      <rect x="3" y="7" width="18" height="10" rx="2" />
      <path d="M8 12h.01M12 12h.01" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.1 0l2.1-2.1a5 5 0 1 0-7.1-7.1L10.7 5" />
      <path d="M14 11a5 5 0 0 0-7.1 0L4.8 13.1a5 5 0 0 0 7.1 7.1L13.3 19" />
    </svg>
  )
}
