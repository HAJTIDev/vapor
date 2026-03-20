import React, { useState, useEffect, useCallback } from 'react'
import Titlebar from './components/Titlebar.jsx'
import Sidebar from './components/Sidebar.jsx'
import Library from './components/Library.jsx'
import GameDetail from './components/GameDetail.jsx'
import Settings from './components/Settings.jsx'
import AddGames from './components/AddGames.jsx'
import vaporApi from './vaporApi.js'

let nextId = Date.now()
const uid = () => String(++nextId)

const defaultSettings = {
  folders: [],
  collections: [],
  ui: {
    sidebarSort: 'recent',
    showPlaytimeInSidebar: true,
    compactSidebar: false,
    confirmRemoveGame: true,
    autoUpdate: true,
    autoStart: true,
  },
}

function normalizeSettings(input) {
  const safe = input || {}
  const collections = Array.isArray(safe.collections)
    ? safe.collections
        .filter(c => c && c.id && c.name)
        .map(c => ({ id: String(c.id), name: String(c.name) }))
    : []
  return {
    folders: Array.isArray(safe.folders) ? safe.folders : [],
    collections,
    ui: {
      ...defaultSettings.ui,
      ...(safe.ui || {}),
    },
  }
}

function normalizeGame(input) {
  const safe = input || {}
  return {
    ...safe,
    favorite: !!safe.favorite,
    collections: Array.isArray(safe.collections) ? safe.collections.map(String) : [],
  }
}

function sortGames(list, mode) {
  const sorted = [...list]
  if (mode === 'name') {
    return sorted.sort((a, b) => a.name.localeCompare(b.name))
  }
  if (mode === 'playtime') {
    return sorted.sort((a, b) => (b.playtime || 0) - (a.playtime || 0))
  }
  return sorted.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0))
}

export default function App() {
  const [games, setGames]           = useState([])
  const [settings, setSettings]     = useState(defaultSettings)
  const [view, setView]             = useState('library') // 'library' | 'settings' | 'add'
  const [selected, setSelected]     = useState(null)
  const [running, setRunning]       = useState({}) // id -> true
  const [search, setSearch]         = useState('')
  const [filterGenre, setFilterGenre] = useState('all')
  const [activeCollection, setActiveCollection] = useState('all')
  const [contextMenu, setContextMenu] = useState({ open: false, x: 0, y: 0, gameId: null })

  // Load
  useEffect(() => {
    vaporApi.games.load().then(g => {
      const normalized = (g || []).map(normalizeGame)
      setGames(normalized)
      if (normalized.length) nextId = Math.max(nextId, ...normalized.map(x => +x.id || 0))
    })
    vaporApi.settings.load().then(s => setSettings(normalizeSettings(s)))
  }, [])

  // Listen for session end
  useEffect(() => {
    const handler = ({ id, minutes }) => {
      setRunning(r => { const n={...r}; delete n[id]; return n })
      setGames(g => {
        const updated = g.map(game => game.id === id
          ? { ...game, playtime: (game.playtime || 0) + minutes, lastPlayed: Date.now() }
          : game)
        vaporApi.games.save(updated)
        return updated
      })
    }
    vaporApi.on('game:session-end', handler)
    return () => vaporApi.off('game:session-end', handler)
  }, [])

  useEffect(() => {
    const valid = new Set(settings.collections.map(c => c.id))
    if (activeCollection !== 'all' && activeCollection !== 'favorites' && !valid.has(activeCollection)) {
      setActiveCollection('all')
      setSelected(null)
      setFilterGenre('all')
    }

    setGames(prev => {
      let changed = false
      const updated = prev.map(game => {
        const nextCollections = (game.collections || []).filter(id => valid.has(id))
        if (nextCollections.length === (game.collections || []).length) return game
        changed = true
        return { ...game, collections: nextCollections }
      })
      if (changed) vaporApi.games.save(updated)
      return changed ? updated : prev
    })
  }, [settings.collections, activeCollection])

  useEffect(() => {
    const close = () => setContextMenu(prev => prev.open ? { ...prev, open: false } : prev)
    const onKeyDown = (event) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('click', close)
    window.addEventListener('resize', close)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('resize', close)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const saveGames = useCallback((updated) => {
    const normalized = updated.map(normalizeGame)
    setGames(normalized)
    vaporApi.games.save(normalized).then(ok => {
      if (!ok) console.error('[App] Failed to save games')
    })
  }, [])

  const saveSettings = useCallback((s) => {
    const normalized = normalizeSettings(s)
    setSettings(normalized)
    vaporApi.settings.save(normalized)
  }, [])

  const launchGame = useCallback(async (game) => {
    setRunning(r => ({ ...r, [game.id]: true }))
    const result = await vaporApi.game.launch(game)
    if (!result.ok) setRunning(r => { const n={...r}; delete n[game.id]; return n })
  }, [])

  const addGames = useCallback((newGames) => {
    setGames(prev => {
      const merged = [...prev]
      for (const g of newGames) {
        if (!merged.find(x => x.exe === g.exe)) {
          merged.push(normalizeGame({ ...g, id: uid(), playtime: 0, lastPlayed: null }))
        }
      }
      vaporApi.games.save(merged)
      return merged
    })
  }, [])

  const updateGame = useCallback((id, patch) => {
    setGames(prev => {
      const updated = prev.map(g => g.id === id ? { ...g, ...patch } : g)
      vaporApi.games.save(updated)
      if (selected?.id === id) setSelected(updated.find(g => g.id === id))
      return updated
    })
  }, [selected])

  const refreshAllArt = useCallback(async (gameId, art) => {
    if (gameId && art) {
      updateGame(gameId, { art })
    }
  }, [updateGame])

  const removeGame = useCallback((id) => {
    if (settings.ui.confirmRemoveGame) {
      const yes = window.confirm('Remove this game from your library?')
      if (!yes) return
    }
    setSelected(null)
    setGames(prev => {
      const updated = prev.filter(g => g.id !== id)
      vaporApi.games.save(updated)
      return updated
    })
  }, [settings.ui.confirmRemoveGame])

  const toggleFavorite = useCallback((id) => {
    setGames(prev => {
      const updated = prev.map(g => g.id === id ? { ...g, favorite: !g.favorite } : g)
      vaporApi.games.save(updated)
      if (selected?.id === id) setSelected(updated.find(g => g.id === id))
      return updated
    })
  }, [selected])

  const toggleCollection = useCallback((id, collectionId) => {
    setGames(prev => {
      const updated = prev.map(g => {
        if (g.id !== id) return g
        const has = (g.collections || []).includes(collectionId)
        const collections = has
          ? (g.collections || []).filter(c => c !== collectionId)
          : [...(g.collections || []), collectionId]
        return { ...g, collections }
      })
      vaporApi.games.save(updated)
      if (selected?.id === id) setSelected(updated.find(g => g.id === id))
      return updated
    })
  }, [selected])

  const openGameContextMenu = useCallback((event, game) => {
    event.preventDefault()
    event.stopPropagation()
    setContextMenu({
      open: true,
      x: event.clientX,
      y: event.clientY,
      gameId: game.id,
    })
  }, [])

  const closeGameContextMenu = useCallback(() => {
    setContextMenu(prev => prev.open ? { ...prev, open: false } : prev)
  }, [])

  const matchesCollection = useCallback((game) => {
    if (activeCollection === 'all') return true
    if (activeCollection === 'favorites') return !!game.favorite
    return (game.collections || []).includes(activeCollection)
  }, [activeCollection])

  const searchFilteredGames = games.filter(g => {
    if (!search) return true
    return g.name.toLowerCase().includes(search.toLowerCase())
  })

  const collectionFilteredGames = searchFilteredGames.filter(matchesCollection)
  const visibleGames = sortGames(collectionFilteredGames, settings.ui.sidebarSort)

  const collectionItems = [
    { id: 'all', name: 'All Games', count: games.length },
    { id: 'favorites', name: 'Favorites', count: games.filter(g => g.favorite).length },
    ...settings.collections.map(c => ({
      ...c,
      count: games.filter(g => (g.collections || []).includes(c.id)).length,
    })),
  ]

  const selectedGame = selected ? games.find(g => g.id === selected.id) || selected : null
  const menuGame = contextMenu.open ? games.find(g => g.id === contextMenu.gameId) : null
  const menuWidth = 260
  const menuX = Math.max(8, Math.min(contextMenu.x, window.innerWidth - menuWidth - 8))
  const menuY = Math.max(8, Math.min(contextMenu.y, window.innerHeight - 320))

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>
      <Titlebar />
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        <Sidebar
          view={view} setView={setView}
          gameCount={games.length}
          search={search} setSearch={setSearch}
          games={visibleGames}
          selectedGameId={selectedGame?.id || null}
          onSelectGame={setSelected}
          onLaunch={launchGame}
          onGameContextMenu={openGameContextMenu}
          running={running}
          collections={collectionItems}
          activeCollection={activeCollection}
          onCollectionSelect={(id) => {
            setActiveCollection(id)
            setView('library')
            setSelected(null)
            setFilterGenre('all')
          }}
          showSidebarPlaytime={settings.ui.showPlaytimeInSidebar}
          compactSidebar={settings.ui.compactSidebar}
          onDeselect={() => setSelected(null)}
        />
        <main style={{ flex:1, overflow:'hidden', position:'relative' }}>
          {view === 'library' && !selectedGame && (
            <Library
              games={visibleGames}
              totalGameCount={games.length}
              running={running}
              search=""
              activeCollection={activeCollection}
              filterGenre={filterGenre}
              setFilterGenre={setFilterGenre}
              onBrowseAllGames={() => {
                setActiveCollection('all')
                setFilterGenre('all')
                setSelected(null)
              }}
              onSelect={setSelected}
              onLaunch={launchGame}
              onGameContextMenu={openGameContextMenu}
              onAddClick={() => setView('add')}
            />
          )}
          {view === 'library' && selectedGame && (
            <GameDetail
              game={selectedGame}
              running={!!running[selectedGame.id]}
              collections={settings.collections}
              onBack={() => setSelected(null)}
              onLaunch={launchGame}
              onUpdate={updateGame}
              onRemove={removeGame}
              onToggleFavorite={toggleFavorite}
              onToggleCollection={toggleCollection}
            />
          )}
          {view === 'settings' && (
            <Settings settings={settings} onSave={saveSettings} games={games} onRefreshAllArt={refreshAllArt} />
          )}
          {view === 'add' && (
            <AddGames
              settings={settings}
              existingGames={games}
              onAdd={addGames}
              onDone={() => setView('library')}
            />
          )}
        </main>
      </div>

      {menuGame && contextMenu.open && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position:'fixed',
            top: menuY,
            left: menuX,
            width: menuWidth,
            background:'var(--surface)',
            border:'1px solid var(--border2)',
            borderRadius:8,
            boxShadow:'0 16px 40px #00000080',
            zIndex:1000,
            overflow:'hidden',
          }}
        >
          <div style={{
            padding:'10px 12px',
            fontSize:12,
            color:'var(--text)',
            borderBottom:'1px solid var(--border)',
            background:'var(--surface2)',
            whiteSpace:'nowrap',
            overflow:'hidden',
            textOverflow:'ellipsis',
          }}>
            {menuGame.name}
          </div>

          <MenuButton
            onClick={() => {
              toggleFavorite(menuGame.id)
              closeGameContextMenu()
            }}
            label={menuGame.favorite ? 'Remove From Favorites' : 'Add To Favorites'}
          />

          {settings.collections.length > 0 && (
            <>
              <div style={{
                padding:'8px 12px 6px',
                fontSize:10,
                letterSpacing:'0.08em',
                textTransform:'uppercase',
                color:'var(--text-muted)',
              }}>
                Collections
              </div>
              <div style={{ maxHeight:180, overflow:'auto', paddingBottom:6 }}>
                {settings.collections.map(collection => {
                  const isIn = (menuGame.collections || []).includes(collection.id)
                  return (
                    <MenuButton
                      key={collection.id}
                      onClick={() => {
                        toggleCollection(menuGame.id, collection.id)
                      }}
                      label={`${isIn ? '✓ ' : ''}${collection.name}`}
                    />
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function MenuButton({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width:'100%',
        textAlign:'left',
        padding:'8px 12px',
        fontSize:12,
        color:'var(--text-dim)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--surface2)'
        e.currentTarget.style.color = 'var(--text)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = 'var(--text-dim)'
      }}
    >
      {label}
    </button>
  )
}
