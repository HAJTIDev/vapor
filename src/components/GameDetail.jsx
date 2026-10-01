import React, { useEffect, useState } from 'react'
import vaporApi from '../vaporApi.js'
import { formatFileSize, sanitizeSteamAppId } from '../utils.js'
import { Button, Text, Badge, Flex, Stat, Divider, spacing, radius, shadows, typography } from './UIKit.jsx'
import BacklogBadge from './BacklogBadge.jsx'
import PlaytimeHeatmap from './PlaytimeHeatmap.jsx'
import SessionLog from './SessionLog.jsx'
import { BACKLOG_STATUSES, getStatusConfig } from '../statusWorkflow.js'
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
  gamepadActionIndex = null,
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


  const handleDeleteSession = (sessionId) => {
    const currentSessions = Array.isArray(game.sessions) ? [...game.sessions] : []
    const target = currentSessions.find(s => (s.id || s) === sessionId)
    const filtered = currentSessions.filter(s => (s.id || s) !== sessionId)
    const removedMins = target ? (Number(target.durationMinutes) || 0) : 0
    const nextPlaytime = Math.max(0, (game.playtime || 0) - removedMins)
    onUpdate(game.id, {
      sessions: filtered,
      playtime: nextPlaytime,
    })
  }

  // HowLongToBeat state
  const [fetchingHltb, setFetchingHltb] = useState(false)
  const [hltbError, setHltbError] = useState('')
  const [showHltbPicker, setShowHltbPicker] = useState(false)
  const [hltbMatches, setHltbMatches] = useState([])
  const [customHltbQuery, setCustomHltbQuery] = useState('')

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
    setHltbError('')
  }, [game])

  // Auto-fetch HLTB if not yet present
  useEffect(() => {
    if (!game.hltb && game.name && !fetchingHltb) {
      fetchHltb(game.name, true)
    }
  }, [game.id])

  const fetchHltb = async (searchTitle = game.name, isAuto = false) => {
    setFetchingHltb(true)
    setHltbError('')
    try {
      const res = await vaporApi.hltb.search(searchTitle)
      if (res?.ok && res.bestMatch) {
        setHltbMatches(res.results || [])
        onUpdate(game.id, { hltb: res.bestMatch })
      } else if (res?.results?.length > 0) {
        setHltbMatches(res.results)
        onUpdate(game.id, { hltb: res.results[0] })
      } else {
        if (!isAuto) setHltbError(res?.error || 'No games found on HowLongToBeat.')
      }
    } catch (err) {
      if (!isAuto) setHltbError(err.message || 'Failed to fetch HLTB')
    }
    setFetchingHltb(false)
  }

  const selectHltbMatch = (match) => {
    onUpdate(game.id, { hltb: match })
    setShowHltbPicker(false)
  }

  // PCGamingWiki state
  const [fetchingPcgw, setFetchingPcgw] = useState(false)
  const [pcgwError, setPcgwError] = useState('')
  const [showPcgwPicker, setShowPcgwPicker] = useState(false)
  const [pcgwMatches, setPcgwMatches] = useState([])
  const [customPcgwQuery, setCustomPcgwQuery] = useState('')

  // Auto-fetch PCGW if not yet present
  useEffect(() => {
    if (!game.pcgw && game.name && !fetchingPcgw) {
      fetchPcgw(game.name, true)
    }
  }, [game.id])

  const fetchPcgw = async (searchTitle = game.name, isAuto = false) => {
    setFetchingPcgw(true)
    setPcgwError('')
    try {
      const res = await vaporApi.pcgw.search({ name: searchTitle })
      if (res?.ok && res.found) {
        setPcgwMatches(res.matches || [])
        onUpdate(game.id, { pcgw: res })
      } else {
        if (!isAuto) setPcgwError(res?.error || 'No matching page found on PCGamingWiki.')
      }
    } catch (err) {
      if (!isAuto) setPcgwError(err.message || 'Failed to fetch PCGamingWiki')
    }
    setFetchingPcgw(false)
  }

  const selectPcgwMatch = async (match) => {
    setFetchingPcgw(true)
    setShowPcgwPicker(false)
    try {
      const res = await vaporApi.pcgw.search({ name: match.title })
      if (res?.ok && res.found) {
        onUpdate(game.id, { pcgw: res })
      }
    } catch (err) {
      setPcgwError(err.message || 'Failed to update PCGamingWiki match')
    }
    setFetchingPcgw(false)
  }

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
      <div className="gd-hero-container" style={{
        background: game.art?.hero 
          ? 'transparent'
          : 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 25%, var(--surface)) 0%, var(--surface2) 100%)',
      }}>
        {game.art?.hero && (
          <img src={game.art.hero} alt="" className="gd-hero-backdrop" />
        )}
        <div className="gd-hero-gradient" />

        {/* Back button */}
        <button
          onClick={onBack}
          className="ui-btn"
          style={{
            position: 'absolute',
            top: spacing.lg,
            left: spacing.lg,
            color: '#fff',
            background: 'rgba(10, 12, 18, 0.65)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            borderRadius: '999px',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            zIndex: 10,
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          }}
        >
          <span>←</span>
          <span>Library</span>
        </button>

        {/* Cover & title overlay */}
        <div style={{
          position: 'absolute',
          bottom: spacing.xxl,
          left: spacing.xxl,
          right: spacing.xxl,
          display: 'flex',
          alignItems: 'flex-end',
          gap: spacing.xl,
          zIndex: 5,
        }}>
          {game.art?.grid && (
            <img src={game.art.grid} alt="" style={{
              width: 120,
              height: 180,
              objectFit: 'cover',
              borderRadius: '12px',
              boxShadow: '0 16px 36px rgba(0,0,0,0.6), 0 0 24px var(--accent-glow)',
              flexShrink: 0,
              border: `2px solid var(--border2)`,
            }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            {game.isVR && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(99, 102, 241, 0.85)',
                border: '1px solid rgba(165, 180, 252, 0.5)',
                backdropFilter: 'blur(8px)',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '12px',
                fontWeight: 700,
                color: '#ffffff',
                marginBottom: spacing.sm,
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
              }}>
                <span>🥽</span>
                <span>Virtual Reality Game</span>
              </div>
            )}
            {game.art?.logo && !logoFailed && (
              <img
                src={game.art.logo}
                alt={game.name}
                style={{
                  maxHeight: 100,
                  maxWidth: 420,
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 6px 20px rgba(0,0,0,0.75))',
                  marginBottom: spacing.sm,
                }}
                onError={() => setLogoFailed(true)}
              />
            )}
            <h1 style={{
              fontSize: '32px',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: '#ffffff',
              textShadow: '0 4px 24px rgba(0,0,0,0.85)',
              display: game.art?.logo && !logoFailed ? 'none' : 'block',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
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
              className={`gd-btn ${gamepadActionIndex === 0 ? 'gamepad-btn-focused' : ''}`}
              onClick={() => onLaunch(game)}
              disabled={running}
              style={{
                width: '100%',
                padding: '14px 20px',
                fontSize: '15px',
                fontWeight: 700,
                letterSpacing: '0.02em',
                boxShadow: running
                  ? '0 6px 20px rgba(34, 197, 94, 0.4)'
                  : '0 6px 22px color-mix(in srgb, var(--accent) 45%, transparent)',
              }}
            >
              {running ? '● Running' : '▶ Play Now'}
            </Button>

            {/* Completion Status Selector Card */}
            <div style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: radius.md,
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                Completion Status
              </div>
              <BacklogBadge
                status={game.status}
                editable={true}
                size="md"
                onChange={(newStatus) => onUpdate(game.id, { status: newStatus })}
                style={{ width: '100%', justifyContent: 'space-between' }}
              />
            </div>

            <Button
              variant="secondary"
              size="md"
              className={gamepadActionIndex === 1 ? 'gamepad-btn-focused' : ''}
              onClick={() => onOpenSettings && onOpenSettings(game)}
              style={{ width: '100%' }}
            >
              ⚙ Settings
            </Button>

            <Button
              variant="secondary"
              size="md"
              className={gamepadActionIndex === 2 ? 'gamepad-btn-focused' : ''}
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
              className={gamepadActionIndex === 3 ? 'gamepad-btn-focused' : ''}
              onClick={() => onToggleFavorite(game.id)}
              style={{ width: '100%' }}
            >
              {game.favorite ? '★ Favorited' : '☆ Add to Favorites'}
            </Button>

            <Button
              variant={game.isVR ? 'primary' : 'secondary'}
              size="md"
              className={gamepadActionIndex === 4 ? 'gamepad-btn-focused' : ''}
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
              style={{ width: '100%' }}
            >
              {game.isVR ? '🥽 VR Game (Enabled)' : '🥽 Mark as VR Game'}
            </Button>

            <Divider />

            <Button
              variant="danger"
              size="md"
              className={gamepadActionIndex === 5 ? 'gamepad-btn-focused' : ''}
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

            {/* Playtime Analytics & Heatmap */}
            <PlaytimeHeatmap
              sessions={game.sessions || []}
              totalPlaytime={game.playtime}
              gameTitle={game.name}
              weeksCount={18}
            />

            {/* Historical Session Log */}
            <SessionLog
              sessions={game.sessions || []}
              gameTitle={game.name}
              onDeleteSession={handleDeleteSession}
            />

            {/* HowLongToBeat */}
            <div
              style={{
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: radius.lg,
                padding: spacing.lg,
                display: 'flex',
                flexDirection: 'column',
                gap: spacing.md,
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
                  <HourglassIcon />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '12px', letterSpacing: '0.06em', color: 'var(--text)', textTransform: 'uppercase' }}>
                      HowLongToBeat
                    </div>
                    {game.hltb?.name && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Matched: <span style={{ color: 'var(--text)' }}>{game.hltb.name}</span>
                        {game.hltb.releaseYear ? ` (${game.hltb.releaseYear})` : ''}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                  {game.hltb?.url && (
                    <button
                      onClick={() => vaporApi.win.openExternal(game.hltb.url)}
                      className="ui-btn"
                      style={{
                        fontSize: '11px',
                        color: 'var(--accent)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                        padding: '5px 10px',
                        borderRadius: radius.sm,
                        border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
                      }}
                    >
                      View on HLTB ↗
                    </button>
                  )}
                  <Button
                    variant="secondary"
                    size="xs"
                    className={gamepadActionIndex === 4 ? 'gamepad-btn-focused' : ''}
                    onClick={() => {
                      setCustomHltbQuery(game.name)
                      setShowHltbPicker(true)
                      fetchHltb(game.name)
                    }}
                    disabled={fetchingHltb}
                  >
                    {fetchingHltb ? 'Fetching...' : '🔍 Find / Refresh'}
                  </Button>
                </div>
              </div>

              {hltbError && (
                <div style={{ fontSize: '11px', color: 'var(--red)', background: 'color-mix(in srgb, var(--red) 10%, transparent)', padding: '6px 10px', borderRadius: radius.md, border: '1px solid color-mix(in srgb, var(--red) 25%, transparent)' }}>
                  {hltbError}
                </div>
              )}

              {game.hltb ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: spacing.md, marginTop: spacing.xs }}>
                  {/* Main Story */}
                  <div
                    className="hltb-pillar-card hltb-pillar-main"
                    style={{
                      background: 'linear-gradient(180deg, color-mix(in srgb, #06b6d4 14%, var(--surface)) 0%, var(--surface) 100%)',
                      border: '1px solid color-mix(in srgb, #06b6d4 35%, transparent)',
                    }}
                  >
                    <div style={{ fontSize: '11px', color: '#06b6d4', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Main Story
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)', marginTop: '4px', fontFamily: 'var(--font)' }}>
                      {game.hltb.main || '--'}
                    </div>
                  </div>

                  {/* Main + Extra */}
                  <div
                    className="hltb-pillar-card hltb-pillar-extra"
                    style={{
                      background: 'linear-gradient(180deg, color-mix(in srgb, var(--accent) 14%, var(--surface)) 0%, var(--surface) 100%)',
                      border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)',
                    }}
                  >
                    <div style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Main + Extra
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)', marginTop: '4px', fontFamily: 'var(--font)' }}>
                      {game.hltb.extra || '--'}
                    </div>
                  </div>

                  {/* Completionist */}
                  <div
                    className="hltb-pillar-card hltb-pillar-comp"
                    style={{
                      background: 'linear-gradient(180deg, color-mix(in srgb, #f59e0b 14%, var(--surface)) 0%, var(--surface) 100%)',
                      border: '1px solid color-mix(in srgb, #f59e0b 35%, transparent)',
                    }}
                  >
                    <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Completionist
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)', marginTop: '4px', fontFamily: 'var(--font)' }}>
                      {game.hltb.completionist || '--'}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: `${spacing.md} 0`, color: 'var(--text-muted)', fontSize: '12px' }}>
                  {fetchingHltb ? 'Searching HowLongToBeat database...' : 'No HowLongToBeat data yet. Click Find / Refresh to look up playtimes.'}
                </div>
              )}
            </div>

            {/* Modal for Picking HLTB match */}
            {showHltbPicker && (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0, 0, 0, 0.75)',
                  backdropFilter: 'blur(6px)',
                  zIndex: 9999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: spacing.xl,
                }}
                onClick={() => setShowHltbPicker(false)}
              >
                <div
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border2)',
                    borderRadius: radius.xl,
                    width: '100%',
                    maxWidth: '540px',
                    maxHeight: '85vh',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: shadows.xl,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ padding: spacing.xl, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
                      <HourglassIcon />
                      <Text.H3>Select HowLongToBeat Match</Text.H3>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setShowHltbPicker(false)}>✕</Button>
                  </div>

                  <div style={{ padding: spacing.lg, borderBottom: '1px solid var(--border)', display: 'flex', gap: spacing.md }}>
                    <input
                      value={customHltbQuery}
                      onChange={(e) => setCustomHltbQuery(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') fetchHltb(customHltbQuery) }}
                      placeholder="Search title on HowLongToBeat..."
                      className="ui-input"
                      style={{ flex: 1, padding: `${spacing.sm} ${spacing.md}`, fontSize: '13px' }}
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => fetchHltb(customHltbQuery)}
                      disabled={fetchingHltb}
                    >
                      {fetchingHltb ? 'Searching...' : 'Search'}
                    </Button>
                  </div>

                  <div style={{ flex: 1, overflow: 'auto', padding: spacing.lg, display: 'flex', flexDirection: 'column', gap: spacing.md }}>
                    {hltbMatches.length === 0 && !fetchingHltb && (
                      <div style={{ textAlign: 'center', padding: spacing.xl, color: 'var(--text-muted)' }}>
                        No matches found. Try modifying your search query above.
                      </div>
                    )}
                    {hltbMatches.map((m) => (
                      <div
                        key={m.id}
                        onClick={() => selectHltbMatch(m)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: spacing.lg,
                          padding: spacing.md,
                          background: 'var(--surface2)',
                          border: '1px solid var(--border)',
                          borderRadius: radius.lg,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                      >
                        {m.image && (
                          <img
                            src={m.image}
                            alt=""
                            style={{ width: '48px', height: '64px', objectFit: 'cover', borderRadius: radius.sm, flexShrink: 0 }}
                          />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {m.name}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {m.releaseYear ? `Year: ${m.releaseYear} • ` : ''}{m.platforms}
                          </div>
                          <div style={{ display: 'flex', gap: spacing.md, marginTop: '6px', fontSize: '11px' }}>
                            <span style={{ color: '#06b6d4' }}>Main: <strong>{m.main || '--'}</strong></span>
                            <span style={{ color: 'var(--accent)' }}>Extra: <strong>{m.extra || '--'}</strong></span>
                            <span style={{ color: '#f59e0b' }}>Comp: <strong>{m.completionist || '--'}</strong></span>
                          </div>
                        </div>
                        <Button variant="secondary" size="xs">Select</Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* PCGamingWiki Card */}
            <div
              style={{
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: radius.lg,
                padding: spacing.lg,
                display: 'flex',
                flexDirection: 'column',
                gap: spacing.md,
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
                  <WrenchIcon />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '12px', letterSpacing: '0.06em', color: 'var(--text)', textTransform: 'uppercase' }}>
                      PCGamingWiki • Fixes & Tweaks
                    </div>
                    {game.pcgw?.title ? (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Matched: <span style={{ color: 'var(--text)', fontWeight: 500 }}>{game.pcgw.title}</span>
                      </div>
                    ) : (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Widescreen, FOV fixes, crash solutions, and save locations
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                  {game.pcgw?.url && (
                    <button
                      onClick={() => vaporApi.win.openExternal(game.pcgw.url)}
                      className="ui-btn"
                      style={{
                        fontSize: '11px',
                        color: '#38bdf8',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: 'color-mix(in srgb, #0284c7 15%, transparent)',
                        padding: '5px 10px',
                        borderRadius: radius.sm,
                        border: '1px solid color-mix(in srgb, #0284c7 30%, transparent)',
                        cursor: 'pointer',
                      }}
                    >
                      Open Wiki ↗
                    </button>
                  )}
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={() => {
                      setCustomPcgwQuery(game.name)
                      setShowPcgwPicker(true)
                      fetchPcgw(game.name)
                    }}
                    disabled={fetchingPcgw}
                  >
                    {fetchingPcgw ? 'Searching...' : '🔍 Find / Match'}
                  </Button>
                </div>
              </div>

              {pcgwError && (
                <div style={{ fontSize: '11px', color: 'var(--red)', background: 'color-mix(in srgb, var(--red) 10%, transparent)', padding: '6px 10px', borderRadius: radius.md, border: '1px solid color-mix(in srgb, var(--red) 25%, transparent)' }}>
                  {pcgwError}
                </div>
              )}

              {game.pcgw?.found ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                  {game.pcgw.sections?.length > 0 ? (
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Direct Jump to Fixes & Patches:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {game.pcgw.sections.map((sec, idx) => (
                          <button
                            key={idx}
                            onClick={() => vaporApi.win.openExternal(sec.url)}
                            style={{
                              fontSize: '11px',
                              padding: '5px 10px',
                              borderRadius: radius.sm,
                              background: 'var(--surface)',
                              border: '1px solid var(--border)',
                              color: 'var(--text-dim)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = 'var(--accent)'
                              e.currentTarget.style.color = 'var(--text)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = 'var(--border)'
                              e.currentTarget.style.color = 'var(--text-dim)'
                            }}
                          >
                            <span>{sec.line.toLowerCase().includes('fov') || sec.line.toLowerCase().includes('field of view') ? '🖥️' : sec.line.toLowerCase().includes('save') ? '💾' : sec.line.toLowerCase().includes('issue') ? '🐛' : sec.line.toLowerCase().includes('launch') ? '⚙️' : '🔧'}</span>
                            <span>{sec.line} ↗</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Found PCGamingWiki article for this game. Click Open Wiki to view all compatibility fixes and tweaks.
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: `${spacing.md} 0`, color: 'var(--text-muted)', fontSize: '12px' }}>
                  {fetchingPcgw ? 'Searching PCGamingWiki database...' : 'No PCGamingWiki article matched yet. Click Find / Match to search.'}
                </div>
              )}
            </div>

            {/* Modal for Picking PCGW match */}
            {showPcgwPicker && (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0, 0, 0, 0.75)',
                  backdropFilter: 'blur(6px)',
                  zIndex: 9999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: spacing.xl,
                }}
                onClick={() => setShowPcgwPicker(false)}
              >
                <div
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border2)',
                    borderRadius: radius.xl,
                    width: '100%',
                    maxWidth: '540px',
                    maxHeight: '85vh',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: shadows.xl,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ padding: spacing.xl, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
                      <WrenchIcon />
                      <Text.H3>Select PCGamingWiki Article</Text.H3>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setShowPcgwPicker(false)}>✕</Button>
                  </div>

                  <div style={{ padding: spacing.lg, borderBottom: '1px solid var(--border)', display: 'flex', gap: spacing.md }}>
                    <input
                      value={customPcgwQuery}
                      onChange={(e) => setCustomPcgwQuery(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') fetchPcgw(customPcgwQuery) }}
                      placeholder="Search title on PCGamingWiki..."
                      className="ui-input"
                      style={{ flex: 1, padding: `${spacing.sm} ${spacing.md}`, fontSize: '13px' }}
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => fetchPcgw(customPcgwQuery)}
                      disabled={fetchingPcgw}
                    >
                      {fetchingPcgw ? 'Searching...' : 'Search'}
                    </Button>
                  </div>

                  <div style={{ flex: 1, overflow: 'auto', padding: spacing.lg, display: 'flex', flexDirection: 'column', gap: spacing.md }}>
                    {pcgwMatches.length === 0 && !fetchingPcgw && (
                      <div style={{ textAlign: 'center', padding: spacing.xl, color: 'var(--text-muted)' }}>
                        No matches found. Try modifying your search query above.
                      </div>
                    )}
                    {pcgwMatches.map((m, idx) => (
                      <div
                        key={idx}
                        onClick={() => selectPcgwMatch(m)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: spacing.lg,
                          padding: spacing.md,
                          background: 'var(--surface2)',
                          border: '1px solid var(--border)',
                          borderRadius: radius.lg,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>
                            {m.title}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', wordBreak: 'break-all' }}>
                            {m.url}
                          </div>
                        </div>
                        <Button variant="secondary" size="xs">Select</Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Power-User Launch Configuration Summary */}
            {(game.launchArgs || game.workingDir || (game.envVars && game.envVars.length > 0) || game.preLaunchScript || game.postExitScript) && (
              <div
                style={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: radius.lg,
                  padding: spacing.lg,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: spacing.sm,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text.Caption style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                    ⚡ Power-User Launch Profile
                  </Text.Caption>
                  <Button variant="ghost" size="xs" onClick={() => onOpenSettings && onOpenSettings(game)}>
                    Configure ⚙
                  </Button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs, fontSize: '12px' }}>
                  {game.launchArgs && (
                    <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'baseline' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px', width: '85px', flexShrink: 0 }}>Arguments:</span>
                      <span style={{ fontFamily: 'var(--mono)', color: 'var(--accent)', background: 'var(--surface)', padding: '2px 6px', borderRadius: radius.xs, fontSize: '11px' }}>
                        {game.launchArgs}
                      </span>
                    </div>
                  )}
                  {game.workingDir && (
                    <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'baseline' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px', width: '85px', flexShrink: 0 }}>Working Dir:</span>
                      <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-dim)', fontSize: '11px', wordBreak: 'break-all' }}>
                        {game.workingDir}
                      </span>
                    </div>
                  )}
                  {game.envVars?.length > 0 && (
                    <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'baseline' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px', width: '85px', flexShrink: 0 }}>Environment:</span>
                      <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>
                        {game.envVars.map(v => `${v.key}=${v.value}`).join(', ')}
                      </span>
                    </div>
                  )}
                  {game.preLaunchScript && (
                    <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'baseline' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px', width: '85px', flexShrink: 0 }}>Pre-Hook:</span>
                      <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-dim)', fontSize: '11px', wordBreak: 'break-all' }}>
                        {game.preLaunchScript} {game.preLaunchWait !== false ? '(wait)' : '(async)'}
                      </span>
                    </div>
                  )}
                  {game.postExitScript && (
                    <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'baseline' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px', width: '85px', flexShrink: 0 }}>Post-Hook:</span>
                      <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-dim)', fontSize: '11px', wordBreak: 'break-all' }}>
                        {game.postExitScript}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

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

function HourglassIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 22h14M5 2h14M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
    </svg>
  )
}

function WrenchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  )
}

