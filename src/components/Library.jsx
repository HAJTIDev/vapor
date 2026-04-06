import React, { useMemo } from 'react'
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

const KOT_CHANCE = 0.00002

function fmtTime(mins) {
  if (!mins) return '0h'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`
}

export default function Library({
  games,
  totalGameCount,
  running,
  search,
  setSearch,
  sortBy,
  setSortBy,
  activeCollection,
  filterGenre,
  setFilterGenre,
  onBrowseAllGames,
  onSelect,
  onLaunch,
  onGameContextMenu,
  onToggleFavorite,
  onAddClick,
}) {
  const genres = useMemo(() => {
    const s = new Set()
    games.forEach(g => (g.genres || []).forEach(x => s.add(x)))
    return ['all', ...s]
  }, [games])

  const filtered = useMemo(() => {
    let list = games
    if (search) list = list.filter(g => g.name.toLowerCase().includes(search.toLowerCase()))
    if (filterGenre !== 'all') list = list.filter(g => (g.genres || []).includes(filterGenre))
    if (sortBy === 'name') {
      return list.sort((a, b) => a.name.localeCompare(b.name))
    }
    if (sortBy === 'playtime') {
      return list.sort((a, b) => (b.playtime || 0) - (a.playtime || 0))
    }
    if (sortBy === 'added') {
      return list.sort((a, b) => (+b.id || 0) - (+a.id || 0))
    }
    return list.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0))
  }, [games, search, filterGenre, sortBy])

  if (totalGameCount === 0) return <Empty onAddClick={onAddClick} />

  return (
    <div className="library-view" style={{ height:'100%', overflow:'auto', padding: spacing.xxl }}>
      {/* Header */}
      <div style={{ marginBottom: spacing.xxl }}>
        <Text.H1>Your Library</Text.H1>
        <Text.Muted>
          {filtered.length} of {totalGameCount} games {search ? `• Searching for "${search}"` : ''}
        </Text.Muted>
      </div>

      {/* Controls */}
      <Flex
        gap={spacing.lg}
        wrap="wrap"
        align="flex-end"
        style={{ marginBottom: spacing.xl }}
      >
        <select
          value={sortBy || 'recent'}
          onChange={(e) => setSortBy?.(e.target.value)}
          className="ui-input"
          style={{
            padding: `${spacing.md} ${spacing.lg}`,
            fontSize: '13px',
          }}
        >
          <option value="recent">Sort: Last Played</option>
          <option value="name">Sort: Name</option>
          <option value="playtime">Sort: Playtime</option>
          <option value="added">Sort: Recently Added</option>
        </select>
        <Button variant="primary" onClick={onAddClick}>
          + Add Games
        </Button>
      </Flex>

      {/* Genre filters */}
      {genres.length > 1 && (
        <Flex
          gap={spacing.sm}
          wrap="wrap"
          style={{ marginBottom: spacing.xl }}
        >
          {genres.map(g => (
            <Button
              key={g}
              variant={filterGenre === g ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setFilterGenre(g)}
            >
              {g}
            </Button>
          ))}
        </Flex>
      )}

      {/* Game grid */}
      <div className="library-grid" style={{
        display:'grid',
        gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))',
        gap: spacing.lg
      }}>
        {filtered.map(game => (
          <GameCard
            key={game.id}
            game={game}
            running={!!running[game.id]}
            onSelect={onSelect}
            onLaunch={onLaunch}
            onContextMenu={onGameContextMenu}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign:'center', color:'var(--text-muted)', paddingTop: spacing.xxxl, fontSize:14 }}>
          <Text.Muted style={{ display: 'block', marginBottom: spacing.lg }}>
            {activeCollection === 'favorites' ? 'No favorite games yet.' : search ? 'No games match your search.' : 'No games match this filter.'}
          </Text.Muted>
          {activeCollection !== 'all' && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onBrowseAllGames}
            >
              Browse All Games
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function GameCard({ game, running, onSelect, onLaunch, onContextMenu, onToggleFavorite }) {
  const [hov, setHov] = React.useState(false)
  const showKot = useMemo(() => Math.random() < KOT_CHANCE, [])

  return (
    <div
      className="game-card"
      onClick={() => onSelect(game)}
      onContextMenu={(e) => onContextMenu(e, game)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        borderRadius: radius.lg,
        overflow:'hidden',
        cursor: 'pointer',
        border: `1px solid ${hov ? 'var(--border2)' : 'var(--border)'}`,
        background:'var(--surface)',
        transition: `all ${transitions.base}`,
        transform: hov ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: hov ? shadows.lg : shadows.sm,
      }}
    >
      {/* Cover art */}
      <div style={{ aspectRatio:'2/3', background:'var(--surface2)', position:'relative', overflow:'hidden' }}>
        {game.art?.grid ? (
          <img src={showKot ? kot : game.art.grid} alt={game.name} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
        ) : (
          <div style={{
            width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center',
            color:'var(--text-muted)', fontSize:32, fontWeight:700, letterSpacing:-1
          }}>
            {game.name[0]?.toUpperCase()}
          </div>
        )}

        {running && (
          <div style={{
            position:'absolute', top: spacing.md, right: spacing.md, width:8, height:8,
            borderRadius:'50%', background:'var(--green)',
            boxShadow: `0 0 8px var(--green), inset 0 0 4px rgba(255,255,255,0.3)`
          }} />
        )}

        {/* Hover overlay */}
        {hov && (
          <div style={{
            position:'absolute', inset:0,
            background:'linear-gradient(to top, #000000cc 0%, transparent 50%)',
            display:'flex', alignItems:'flex-end', justifyContent:'center', padding: spacing.md,
            animation: 'fadeIn 0.15s ease',
          }}>
            <Button
              variant={running ? 'success' : 'primary'}
              size="sm"
              onClick={e => { e.stopPropagation(); onLaunch(game) }}
              style={{ width: '100%' }}
            >
              {running ? '● Running' : '▶ Play'}
            </Button>
          </div>
        )}
      </div>

      {/* Info section */}
      <div style={{ padding: spacing.md }}>
        <Text.Body style={{ fontWeight: 500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginBottom: spacing.sm }}>
          {game.name}
        </Text.Body>
        <Flex justify="space-between" align="center" style={{ minHeight: '20px' }}>
          {game.playtime > 0 ? (
            <Text.Caption mono>{fmtTime(game.playtime)}</Text.Caption>
          ) : <div />}
          {!running && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(game.id); }}
              style={{
                background: 'none',
                border: 'none',
                padding: spacing.xs,
                cursor: 'pointer',
                fontSize: '16px',
                transition: `transform ${transitions.fast}`,
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              title={game.favorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              {game.favorite ? '★' : '♡'}
            </button>
          )}
        </Flex>
      </div>
    </div>
  )
}

function Empty({ onAddClick }) {
  return (
    <div style={{
      height:'100%', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', gap: spacing.lg, color:'var(--text-muted)',
      padding: spacing.xxl,
    }}>
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.25">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
      <div style={{ textAlign:'center' }}>
        <Text.H3 style={{ color: 'var(--text)', marginBottom: spacing.sm }}>Your library is empty</Text.H3>
        <Text.Body dim>Add your first game folder to get started</Text.Body>
      </div>
      <Button variant="primary" size="lg" onClick={onAddClick}>
        Add Games
      </Button>
    </div>
  )
}
