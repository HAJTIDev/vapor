import React, { useMemo, useState, useRef, useEffect } from 'react'
import {
  Button,
  Text,
  Badge,
  Flex,
  spacing,
  radius,
  shadows,
  transitions,
  typography,
} from './UIKit'
import kot from '../img/kot.jpg'
import { BACKLOG_STATUSES } from '../statusWorkflow.js'
import BacklogBadge from './BacklogBadge.jsx'
import GameCoverArt from './GameCoverArt.jsx'

const KOT_CHANCE = 0.00002

function fmtTime(mins) {
  if (!mins) return '0h'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`
}

export default function Library({
  games,
  allCollectionGames = [],
  totalGameCount,
  running,
  search,
  setSearch,
  sortBy,
  setSortBy,
  activeCollection,
  filterGenre,
  setFilterGenre,
  filterStatus = 'all',
  setFilterStatus,
  onUpdateGameStatus,
  onBrowseAllGames,
  onSelect,
  onLaunch,
  onGameContextMenu,
  onToggleFavorite,
  onAddClick,
  gamepadFocusedIndex = null,
}) {
  const statusCounts = useMemo(() => {
    const counts = {}
    BACKLOG_STATUSES.forEach(s => { counts[s.id] = 0 })
    const pool = (allCollectionGames && allCollectionGames.length > 0) ? allCollectionGames : games
    pool.forEach(g => {
      if (g.status && counts[g.status] !== undefined) {
        counts[g.status] += 1
      }
    })
    return counts
  }, [allCollectionGames, games])
  const genres = useMemo(() => {
    const s = new Set()
    const pool = (allCollectionGames && allCollectionGames.length > 0) ? allCollectionGames : games
    pool.forEach(g => (g.genres || []).forEach(x => s.add(x)))
    return ['all', ...s]
  }, [allCollectionGames, games])

  const filtered = games

  if (totalGameCount === 0) return <Empty onAddClick={onAddClick} />

  return (
    <div className="library-view" style={{ height: '100%', overflow: 'auto', padding: '28px 32px' }}>
      {/* Header section with ambient glow */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '24px',
        position: 'relative',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{
              fontSize: '26px',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: 'var(--text)',
              lineHeight: 1.2,
            }}>
              {activeCollection === 'favorites' ? 'Favorites ★' : activeCollection === 'vr' ? 'VR Games 🥽' : 'Your Library'}
            </h1>
            <span style={{
              fontSize: '11px',
              fontFamily: 'var(--mono)',
              fontWeight: 600,
              color: 'var(--text-dim)',
              background: 'var(--surface2)',
              border: '1px solid var(--border2)',
              padding: '3px 10px',
              borderRadius: '999px',
            }}>
              {filtered.length} {filtered.length === 1 ? 'game' : 'games'}
            </span>
          </div>
          {search && (
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Results matching <span style={{ color: 'var(--text)', fontWeight: 500 }}>"{search}"</span>
            </div>
          )}
        </div>

        {/* Top Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <select
              value={sortBy || 'recent'}
              onChange={(e) => setSortBy?.(e.target.value)}
              className="ui-input"
              style={{
                padding: '8px 32px 8px 14px',
                fontSize: '13px',
                fontWeight: 500,
                appearance: 'none',
                WebkitAppearance: 'none',
                cursor: 'pointer',
                borderRadius: '8px',
                background: 'var(--surface2)',
                color: 'var(--text)',
                border: '1px solid var(--border2)',
              }}
            >
              <option value="recent">Sort: Last Played</option>
              <option value="name">Sort: Alphabetical</option>
              <option value="playtime">Sort: Playtime</option>
              <option value="added">Sort: Recently Added</option>
            </select>
            <span style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              fontSize: '10px',
              color: 'var(--text-muted)',
            }}>
              ▼
            </span>
          </div>

          <button
            onClick={onAddClick}
            className="ui-btn btn-accent"
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>+</span>
            <span>Add Games</span>
          </button>
        </div>
      </div>

      {/* Backlog Status Filter Chips */}
      <div style={{
        display: 'flex',
        gap: '6px',
        flexWrap: 'wrap',
        alignItems: 'center',
        marginBottom: genres.length > 1 ? '10px' : '20px',
      }}>
        <button
          onClick={() => setFilterStatus?.('all')}
          className="ui-btn"
          style={{
            padding: '4px 12px',
            borderRadius: '999px',
            fontSize: '11px',
            fontWeight: filterStatus === 'all' ? 700 : 500,
            background: filterStatus === 'all' ? 'var(--accent-gradient)' : 'var(--surface2)',
            color: filterStatus === 'all' ? '#ffffff' : 'var(--text-dim)',
            border: `1px solid ${filterStatus === 'all' ? 'transparent' : 'var(--border)'}`,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          All Statuses ({totalGameCount})
        </button>
        {BACKLOG_STATUSES.map(st => {
          const isCurrent = filterStatus === st.id
          const count = statusCounts[st.id] || 0
          return (
            <button
              key={st.id}
              onClick={() => setFilterStatus?.(isCurrent ? 'all' : st.id)}
              className="ui-btn"
              style={{
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: isCurrent ? 700 : 500,
                background: isCurrent ? st.bg : 'var(--surface2)',
                color: isCurrent ? st.color : 'var(--text-dim)',
                border: `1px solid ${isCurrent ? st.border : 'var(--border)'}`,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s ease',
                boxShadow: isCurrent ? `0 0 10px ${st.glow}` : 'none',
              }}
            >
              <span>{st.icon}</span>
              <span>{st.label}</span>
              <span style={{
                fontSize: '10px',
                fontFamily: 'var(--mono)',
                opacity: 0.8,
                background: isCurrent ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.2)',
                padding: '1px 5px',
                borderRadius: 8,
              }}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Genre Filter Chips */}
      {genres.length > 1 && (
        <div style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: '24px',
          paddingBottom: '4px',
        }}>
          {genres.map(g => {
            const isActive = filterGenre === g
            return (
              <button
                key={g}
                onClick={() => setFilterGenre(g)}
                className="ui-btn"
                style={{
                  padding: '5px 14px',
                  borderRadius: '999px',
                  fontSize: '12px',
                  fontWeight: isActive ? 600 : 500,
                  transition: 'all 0.15s ease',
                  background: isActive ? 'var(--accent-gradient)' : 'color-mix(in srgb, var(--surface2) 80%, transparent)',
                  color: isActive ? '#ffffff' : 'var(--text-dim)',
                  border: `1px solid ${isActive ? 'transparent' : 'var(--border)'}`,
                  boxShadow: isActive ? '0 4px 12px color-mix(in srgb, var(--accent) 30%, transparent)' : 'none',
                }}
              >
                {g === 'all' ? 'All Genres' : g}
              </button>
            )
          })}
        </div>
      )}

      {/* Game grid */}
      <div className="library-grid">
        {filtered.map((game, idx) => (
          <GameCard
            key={game.id}
            game={game}
            running={!!running[game.id]}
            onSelect={onSelect}
            onLaunch={onLaunch}
            onContextMenu={onGameContextMenu}
            onToggleFavorite={onToggleFavorite}
            onUpdateGameStatus={onUpdateGameStatus}
            isGamepadFocused={gamepadFocusedIndex === idx}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{
          textAlign: 'center',
          color: 'var(--text-muted)',
          paddingTop: '60px',
          fontSize: '14px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'var(--surface2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            color: 'var(--text-dim)',
          }}>
            🔍
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>
              {activeCollection === 'favorites'
                ? 'No favorite games yet'
                : activeCollection === 'vr'
                ? 'No VR games found'
                : search
                ? `No games match "${search}"`
                : 'No games match this filter'}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {activeCollection === 'vr'
                ? 'Games with VR support or SteamVR/OpenXR integration will appear here automatically.'
                : 'Try adjusting your search terms or genre filter.'}
            </div>
          </div>
          {activeCollection !== 'all' && (
            <button
              onClick={onBrowseAllGames}
              className="ui-btn"
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 500,
                background: 'var(--surface2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
              }}
            >
              Browse All Games
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function GameCard({ game, running, onSelect, onLaunch, onContextMenu, onToggleFavorite, onUpdateGameStatus, isGamepadFocused }) {
  const cardRef = useRef(null)
  const [hov, setHov] = useState(false)
  const showKot = useMemo(() => Math.random() < KOT_CHANCE, [])

  useEffect(() => {
    if (isGamepadFocused && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [isGamepadFocused])

  return (
    <div
      ref={cardRef}
      className={`game-card ${isGamepadFocused ? 'gamepad-focused' : ''}`}
      onClick={() => onSelect(game)}
      onContextMenu={(e) => onContextMenu(e, game)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {/* Cover art container */}
      <div className="cover-art-wrapper">
        {/* Floating Badges (Status, HLTB, VR) */}
        <div style={{
          position: 'absolute',
          top: 10,
          left: 10,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          zIndex: 4,
        }}>
          <BacklogBadge
            status={game.status}
            editable={true}
            size="xs"
            onChange={(newStatus) => onUpdateGameStatus?.(game.id, newStatus)}
            style={{
              opacity: game.status || hov || isGamepadFocused ? 1 : 0,
              transition: 'opacity 0.18s ease',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            }}
          />
          {game.hltb?.main && (
            <div
              title={`HowLongToBeat: Main Story ${game.hltb.main}`}
              style={{
                background: 'rgba(8, 12, 20, 0.8)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                borderRadius: '6px',
                padding: '3px 8px',
                fontSize: '11px',
                fontWeight: 700,
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.45)',
              }}
            >
              <span style={{ fontSize: '10px' }}>⏱</span>
              <span>{game.hltb.main}</span>
            </div>
          )}

          {game.isVR && (
            <div
              title="Virtual Reality Game"
              style={{
                background: 'rgba(99, 102, 241, 0.88)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: '1px solid rgba(165, 180, 252, 0.5)',
                borderRadius: '6px',
                padding: '3px 7px',
                fontSize: '11px',
                fontWeight: 700,
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.45)',
              }}
            >
              <span style={{ fontSize: '11px' }}>🥽</span>
              <span>VR</span>
            </div>
          )}
        </div>

        {/* Live Running Badge */}
        {running && (
          <div
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              background: 'rgba(12, 36, 20, 0.88)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid rgba(74, 222, 128, 0.6)',
              borderRadius: '6px',
              padding: '3px 8px',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.05em',
              color: '#4ade80',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              zIndex: 4,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.45)',
            }}
          >
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#4ade80',
              animation: 'livePulse 1.8s infinite',
            }} />
            <span>RUNNING</span>
          </div>
        )}

        {/* 1-Click Favorite Toggle Button */}
        {!running && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleFavorite?.(game.id)
            }}
            title={game.favorite ? 'Remove from favorites' : 'Add to favorites'}
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              width: 28,
              height: 28,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: game.favorite ? 'rgba(245, 158, 11, 0.28)' : 'rgba(10, 12, 18, 0.72)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: `1px solid ${game.favorite ? 'rgba(245, 158, 11, 0.6)' : 'rgba(255, 255, 255, 0.16)'}`,
              color: game.favorite ? '#fbbf24' : 'rgba(255, 255, 255, 0.75)',
              fontSize: '13px',
              boxShadow: game.favorite ? '0 0 10px rgba(245, 158, 11, 0.4)' : '0 2px 8px rgba(0,0,0,0.3)',
              zIndex: 4,
              cursor: 'pointer',
              transition: 'transform 0.18s ease, background 0.18s ease, color 0.18s ease',
              opacity: game.favorite || hov || isGamepadFocused ? 1 : 0,
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.15)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            {game.favorite ? '★' : '☆'}
          </button>
        )}

        {/* Cover Art Image or Procedural Fallback Poster */}
        <GameCoverArt
          game={game}
          src={showKot ? kot : game.art?.grid}
          alt={game.name}
          variant="card"
          className="cover-art-img"
        />

        <div className="cover-overlay-gradient" />

        {/* Hover Action Deck: Quick Play */}
        <div className="cover-action-deck">
          <button
            className="ui-btn"
            onClick={(e) => {
              e.stopPropagation()
              onLaunch(game)
            }}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '12px',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              background: running ? 'var(--green-gradient)' : 'var(--accent-gradient)',
              color: '#ffffff',
              boxShadow: running
                ? '0 4px 14px rgba(34, 197, 94, 0.4)'
                : '0 4px 14px color-mix(in srgb, var(--accent) 45%, transparent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            {running ? '● Running' : '▶ Play'}
          </button>
        </div>
      </div>

      {/* Info footer */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div
          title={game.name}
          style={{
            fontWeight: 600,
            fontSize: '14px',
            lineHeight: 1.3,
            color: 'var(--text)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {game.name}
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: 'var(--text-dim)',
          minHeight: '18px',
        }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {game.playtime > 0 ? (
              <>
                <span style={{ opacity: 0.7 }}>⏱</span>
                <span>{fmtTime(game.playtime)}</span>
              </>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Never played</span>
            )}
          </span>
          {game.genres?.[0] && (
            <span style={{
              fontSize: '10px',
              color: 'var(--text-muted)',
              background: 'var(--surface2)',
              padding: '1px 6px',
              borderRadius: '4px',
              border: '1px solid var(--border)',
              maxWidth: '85px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {game.genres[0]}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function Empty({ onAddClick }) {
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '20px',
      color: 'var(--text-muted)',
      padding: '32px',
    }}>
      <div style={{
        width: 80,
        height: 80,
        borderRadius: '20px',
        background: 'color-mix(in srgb, var(--accent) 15%, var(--surface))',
        border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 8px 32px color-mix(in srgb, var(--accent) 20%, transparent)',
      }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      </div>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', marginBottom: '8px' }}>
          Your library is empty
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--text-dim)', maxWidth: '360px', lineHeight: 1.5 }}>
          Add your game folders or scanned directories to start launching DRM-free games with full controller support.
        </p>
      </div>
      <button
        onClick={onAddClick}
        className="ui-btn btn-accent"
        style={{
          padding: '12px 28px',
          borderRadius: '10px',
          fontSize: '14px',
          fontWeight: 600,
        }}
      >
        + Add Games to Library
      </button>
    </div>
  )
}
