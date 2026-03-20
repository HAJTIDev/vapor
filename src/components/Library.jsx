import React, { useMemo } from 'react'
import kot from '../img/kot.jpg'

const KOT_CHANCE = 0.01

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
  activeCollection,
  filterGenre,
  setFilterGenre,
  onBrowseAllGames,
  onSelect,
  onLaunch,
  onGameContextMenu,
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
    return list.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0))
  }, [games, search, filterGenre])

  if (totalGameCount === 0) return <Empty onAddClick={onAddClick} />

  return (
    <div style={{ height:'100%', overflow:'auto', padding:'20px 24px' }}>
      {/* Genre filters */}
      {genres.length > 1 && (
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:20 }}>
          {genres.map(g => (
            <button key={g} onClick={() => setFilterGenre(g)} style={{
              padding:'4px 12px', borderRadius:20, fontSize:12,
              background: filterGenre === g ? 'var(--accent)' : 'var(--surface)',
              color: filterGenre === g ? '#fff' : 'var(--text-dim)',
              border: '1px solid ' + (filterGenre === g ? 'var(--accent)' : 'var(--border)'),
              transition:'all 0.12s', textTransform:'capitalize'
            }}>{g}</button>
          ))}
        </div>
      )}

      <div style={{
        display:'grid',
        gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))',
        gap:16
      }}>
        {filtered.map(game => (
          <GameCard
            key={game.id}
            game={game}
            running={!!running[game.id]}
            onSelect={onSelect}
            onLaunch={onLaunch}
            onContextMenu={onGameContextMenu}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign:'center', color:'var(--text-muted)', paddingTop:80, fontSize:14 }}>
          {activeCollection === 'favorites' ? 'No favorite games yet.' : 'No games match this filter.'}
          {activeCollection !== 'all' && (
            <div style={{ marginTop:10 }}>
              <button
                onClick={onBrowseAllGames}
                style={{
                  padding:'7px 14px',
                  borderRadius:6,
                  background:'var(--surface2)',
                  color:'var(--text-dim)',
                  border:'1px solid var(--border)',
                  fontSize:12,
                }}
              >
                Browse All Games
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function GameCard({ game, running, onSelect, onLaunch, onContextMenu }) {
  const [hov, setHov] = React.useState(false)
  const showKot = useMemo(() => Math.random() < KOT_CHANCE, [])

  return (
    <div
      onClick={() => onSelect(game)}
      onContextMenu={(e) => onContextMenu(e, game)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        borderRadius:8, overflow:'hidden', cursor:'pointer',
        border:'1px solid ' + (hov ? 'var(--border2)' : 'var(--border)'),
        background:'var(--surface)',
        transition:'all 0.15s', transform: hov ? 'translateY(-2px)' : 'none',
        boxShadow: hov ? '0 8px 24px #00000060' : 'none',
        position:'relative'
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
            position:'absolute', top:8, right:8, width:8, height:8,
            borderRadius:'50%', background:'var(--green)',
            boxShadow:'0 0 6px var(--green)'
          }} />
        )}

        {/* Hover overlay */}
        {hov && (
          <div style={{
            position:'absolute', inset:0,
            background:'linear-gradient(to top, #000000cc 0%, transparent 50%)',
            display:'flex', alignItems:'flex-end', justifyContent:'center', padding:12
          }}>
            <button onClick={e => { e.stopPropagation(); onLaunch(game) }} style={{
              padding:'6px 18px', borderRadius:5, fontSize:12, fontWeight:600,
              background: running ? 'var(--green)' : 'var(--accent)',
              color:'#fff', transition:'all 0.1s', width:'100%'
            }}>
              {running ? 'Running' : 'Play'}
            </button>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding:'10px 10px 8px' }}>
        <div style={{ fontSize:12, fontWeight:500, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
          {game.name}
        </div>
        {game.playtime > 0 && (
          <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2, fontFamily:'var(--mono)' }}>
            {fmtTime(game.playtime)}
          </div>
        )}
      </div>
    </div>
  )
}

function Empty({ onAddClick }) {
  return (
    <div style={{
      height:'100%', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', gap:16, color:'var(--text-muted)'
    }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:15, color:'var(--text)', fontWeight:500 }}>Your library is empty</div>
        <div style={{ fontSize:13, marginTop:4 }}>Add your game folders to get started</div>
      </div>
      <button onClick={onAddClick} style={{
        padding:'8px 20px', borderRadius:6, background:'var(--accent)',
        color:'#fff', fontSize:13, fontWeight:500, marginTop:4
      }}>Add Games</button>
    </div>
  )
}
