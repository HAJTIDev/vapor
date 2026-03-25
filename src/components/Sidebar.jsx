import React from 'react'

function fmtTime(mins) {
  if (!mins) return '0h'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`
}

export default function Sidebar({
  view,
  setView,
  gameCount,
  search,
  setSearch,
  onDeselect,
  collections,
  activeCollection,
  onCollectionSelect,
  games,
  selectedGameId,
  onSelectGame,
  onLaunch,
  onGameContextMenu,
  running,
  showSidebarPlaytime,
  compactSidebar,
}) {
  const go = (v) => { setView(v); onDeselect() }
  const activeCollectionLabel = collections.find(c => c.id === activeCollection)?.name || 'Games'

  return (
    <aside style={{
      width: compactSidebar ? 250 : 290,
      flexShrink: 0,
      background: 'var(--bg)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      boxShadow: 'inset -1px 0 0 #ffffff08',
    }}>
      <div style={{ padding:'12px 12px 6px' }}>
        <div style={{
          display:'flex',
          alignItems:'center',
          justifyContent:'space-between',
          marginBottom:10,
          padding:'0 2px',
        }}>
          <span style={{ fontSize:14, fontWeight:600, letterSpacing:'0.02em' }}>Vapor</span>
          <span style={{
            fontSize:10,
            fontFamily:'var(--mono)',
            color:'var(--text-muted)',
            background:'var(--surface2)',
            border:'1px solid var(--border)',
            borderRadius:999,
            padding:'2px 8px',
          }}>
            {gameCount} games
          </span>
        </div>

        <div style={{
          display:'flex', alignItems:'center', gap:8,
          background:'var(--surface2)',
          border:'1px solid var(--border)',
          borderRadius:10,
          padding:'8px 10px',
          boxShadow:'0 8px 24px #00000025'
        }} className="ui-input">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); go('library') }}
            placeholder="Search..."
            className="ui-input"
            style={{
              background:'none', border:'none', color:'var(--text)', fontSize:13,
              width:'100%'
            }}
          />
          {!!search && (
            <button
              onClick={() => setSearch('')}
              className="ui-btn"
              style={{
                color:'var(--text-muted)',
                fontSize:12,
                lineHeight:1,
                padding:'0 2px',
              }}
              title="Clear search"
            >
              x
            </button>
          )}
        </div>
      </div>

      <nav style={{ padding:'4px 8px 8px', display:'flex', flexDirection:'column', gap:4 }}>
        <NavItem active={view==='library'} onClick={() => go('library')} icon={<GridIcon />} label="Library" badge={gameCount} />
        <NavItem active={view==='add'}     onClick={() => go('add')}     icon={<PlusIcon />} label="Add Games" />
        <NavItem active={view==='downloads'} onClick={() => go('downloads')} icon={<DownloadIcon />} label="Downloads" />
        <NavItem active={view==='settings'} onClick={() => go('settings')} icon={<GearIcon />} label="Settings" />
      </nav>

      <SectionLabel>Collections</SectionLabel>
      <div style={{
        padding:'0 8px 8px',
        display:'flex',
        flexDirection:'column',
        gap:4,
      }}>
        {collections.map(c => (
          <CollectionItem
            key={c.id}
            active={activeCollection === c.id}
            label={c.name}
            count={c.count}
            onClick={() => onCollectionSelect(c.id)}
          />
        ))}
      </div>

      <SectionLabel>{activeCollection === 'all' ? 'All Games' : activeCollectionLabel}</SectionLabel>
      <div style={{
        flex:1,
        overflow:'auto',
        padding:'0 8px 10px',
        display:'flex',
        flexDirection:'column',
        gap:4,
      }}>
        {games.map(game => (
          <GameRow
            key={game.id}
            game={game}
            compact={compactSidebar}
            active={selectedGameId === game.id && view === 'library'}
            running={!!running[game.id]}
            showPlaytime={showSidebarPlaytime}
            onClick={() => {
              setView('library')
              onSelectGame(game)
            }}
            onLaunch={() => onLaunch(game)}
            onContextMenu={(e) => onGameContextMenu(e, game)}
          />
        ))}
        {games.length === 0 && (
          <div style={{ color:'var(--text-muted)', fontSize:12, padding:'10px 8px' }}>
            No games found.
          </div>
        )}
      </div>
    </aside>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{
      padding:'10px 14px 6px',
      fontSize:10,
      textTransform:'uppercase',
      letterSpacing:'0.12em',
      color:'var(--text-muted)'
    }}>
      {children}
    </div>
  )
}

function CollectionItem({ active, label, count, onClick }) {
  const [hov, setHov] = React.useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display:'flex', alignItems:'center', gap:8,
        width:'100%', textAlign:'left', padding:'8px 10px', borderRadius:8,
        background: active ? 'var(--accent-dim)' : hov ? 'var(--surface2)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-dim)',
        fontSize:12,
        border:'1px solid ' + (active ? 'var(--accent)' : 'transparent'),
        transition:'all 0.12s',
      }}
    >
      <span style={{ flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{label}</span>
      <span style={{
        fontSize:10, fontFamily:'var(--mono)', color: active ? 'var(--accent)' : 'var(--text-muted)',
        background: active ? 'var(--accent-dim)' : 'var(--surface2)', padding:'1px 6px', borderRadius:10,
        border:'1px solid ' + (active ? 'var(--accent)' : 'var(--border)')
      }}>{count || 0}</span>
    </button>
  )
}

function GameRow({ game, active, running, showPlaytime, compact, onClick, onLaunch, onContextMenu }) {
  const [hov, setHov] = React.useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
      onContextMenu={onContextMenu}
      style={{
        display:'flex', alignItems:'center', gap:8,
        borderRadius:8,
        padding: compact ? '7px 8px' : '8px 9px',
        cursor:'pointer',
        background: active ? 'var(--accent-dim)' : hov ? 'var(--surface2)' : 'transparent',
        border: '1px solid ' + (active ? 'var(--accent)' : hov ? 'var(--border)' : 'transparent'),
        transition:'all 0.12s',
      }}
    >
      <div style={{
        width: compact ? 20 : 24,
        height: compact ? 28 : 32,
        borderRadius:6,
        overflow:'hidden',
        background:'var(--surface2)',
        flexShrink:0,
        border:'1px solid var(--border)',
      }}>
        {game.art?.grid ? (
          <img src={game.art.grid} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        ) : (
          <div style={{
            width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center',
            color:'var(--text-muted)', fontSize:11, fontWeight:700
          }}>
            {game.name?.[0]?.toUpperCase() || '?'}
          </div>
        )}
      </div>

      <div style={{ flex:1, minWidth:0 }}>
        <div style={{
          fontSize:14,
          color: active ? 'var(--text)' : 'var(--text-dim)',
          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'
        }}>
          {game.name}
        </div>
      </div>

      {running ? (
        <span style={{
          width:7, height:7, borderRadius:'50%', background:'var(--green)', boxShadow:'0 0 6px var(--green)', flexShrink:0
        }} />
      ) : hov ? (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onLaunch() }}
            style={{
              fontSize:10, padding:'4px 8px', borderRadius:5,
              background:'var(--accent)', color:'#fff', flexShrink:0,
              border:'1px solid #ffffff26'
            }}
          >
            Play
          </button>
          {showPlaytime && !compact && (
            <span style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--mono)' }}>
              {fmtTime(game.playtime || 0)}
            </span>
          )}
        </div>
      ) : showPlaytime && !compact && !hov ? (
        <span style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'var(--mono)', flexShrink:0 }}>
          {fmtTime(game.playtime || 0)}
        </span>
      ) : null}
    </div>
  )
}

function NavItem({ active, onClick, icon, label, badge }) {
  const [hov, setHov] = React.useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position:'relative',
        display:'flex', alignItems:'center', gap:10, padding:'9px 10px',
        borderRadius:8, width:'100%', textAlign:'left',
        background: active ? 'var(--accent-dim)' : hov ? 'var(--surface2)' : 'transparent',
        color: active ? 'var(--accent)' : hov ? 'var(--text)' : 'var(--text-dim)',
        fontSize:13, fontWeight: active ? 500 : 400,
        transition:'all 0.12s',
        border:'1px solid ' + (active ? 'var(--accent)' : 'transparent'),
      }}
    >
      {active && (
        <span style={{
          position:'absolute',
          left:4,
          top:7,
          bottom:7,
          width:3,
          borderRadius:999,
          background:'var(--accent)',
        }} />
      )}
      <span style={{ opacity: active ? 1 : 0.6 }}>{icon}</span>
      <span style={{ flex:1 }}>{label}</span>
      {badge != null && badge > 0 && (
        <span style={{
          fontSize:10, fontFamily:'var(--mono)', color:'var(--text-muted)',
          background: active ? '#6c63ff22' : 'var(--surface2)',
          padding:'1px 6px',
          borderRadius:10,
          border:'1px solid ' + (active ? '#6c63ff30' : 'var(--border)')
        }}>{badge}</span>
      )}
    </button>
  )
}

const GridIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
)
const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M12 5v14M5 12h14"/>
  </svg>
)
const GearIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
)
const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <path d="M12 3v11"/>
    <path d="m7 10 5 5 5-5"/>
    <path d="M4 20h16"/>
  </svg>
)
