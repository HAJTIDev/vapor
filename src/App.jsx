import React, { useState, useEffect, useCallback } from 'react'
import Titlebar from './components/Titlebar.jsx'
import Sidebar from './components/Sidebar.jsx'
import Library from './components/Library.jsx'
import GameDetail from './components/GameDetail.jsx'
import GameSettings from './components/GameSettings.jsx'
import Settings from './components/Settings.jsx'
import AddGames from './components/AddGames.jsx'
import Downloader from './components/Downloader.jsx'
import vaporApi from './vaporApi.js'
import { applyTheme } from './themes.js'
import titleLogo from './img/title.png'

function BootAnimation({ onComplete }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 1500)
    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#09090e',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      animation: 'bootFadeOut 0.5s ease-out 1s forwards',
      pointerEvents: 'none',
    }}>
      <img
        src={titleLogo}
        alt="Vapor"
        style={{
          width: '40vw',
          maxWidth: 500,
          height: 'auto',
          filter: 'drop-shadow(0 0 40px rgba(147, 51, 234, 0.5))',
        }}
      />
      <style>{`
        @keyframes bootFadeOut {
          to {
            opacity: 0;
            visibility: hidden;
          }
        }
      `}</style>
    </div>
  )
}

let nextId = Date.now()
const uid = () => String(++nextId)

const defaultSettings = {
  theme: 'dark',
  folders: [],
  collections: [],
  downloadSpeedLimitKbps: 0,
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
    theme: safe.theme || defaultSettings.theme,
    folders: Array.isArray(safe.folders) ? safe.folders : [],
    collections,
    downloadSpeedLimitKbps: Number.isFinite(Number(safe.downloadSpeedLimitKbps))
      ? Math.max(0, Math.round(Number(safe.downloadSpeedLimitKbps)))
      : 0,
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
    runAsAdmin: !!safe.runAsAdmin,
    fileSize: Number.isFinite(Number(safe.fileSize)) ? Math.max(0, Math.round(Number(safe.fileSize))) : 0,
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
  const [view, setView]             = useState('library') // 'library' | 'settings' | 'add' | 'downloads'
  const [selected, setSelected]     = useState(null)
  const [running, setRunning]       = useState({}) // id -> true
  const [search, setSearch]         = useState('')
  const [librarySort, setLibrarySort] = useState('recent')
  const [filterGenre, setFilterGenre] = useState('all')
  const [activeCollection, setActiveCollection] = useState('all')
  const [contextMenu, setContextMenu] = useState({ open: false, x: 0, y: 0, gameId: null })
  const [settingsPopup, setSettingsPopup] = useState({ open: false, game: null })
  const [showBoot, setShowBoot]     = useState(true)

  // Load
  useEffect(() => {
    vaporApi.games.load().then(async g => {
      const normalized = (g || []).map(normalizeGame)
      setGames(normalized)
      if (normalized.length) nextId = Math.max(nextId, ...normalized.map(x => +x.id || 0))

      const canReadFolderSize = typeof vaporApi?.folder?.getSize === 'function'
      if (!canReadFolderSize || normalized.length === 0) return

      const needsSizeBackfill = normalized.some(game => game.folder && (game.fileSize || 0) <= 0)
      if (!needsSizeBackfill) return

      const withSizes = await Promise.all(normalized.map(async (game) => {
        if (!game.folder || (game.fileSize || 0) > 0) return game
        try {
          const size = await vaporApi.folder.getSize(game.folder)
          const nextSize = Number.isFinite(Number(size)) ? Math.max(0, Math.round(Number(size))) : 0
          return nextSize > 0 ? { ...game, fileSize: nextSize } : game
        } catch {
          return game
        }
      }))

      const changed = withSizes.some((game, idx) => (game.fileSize || 0) !== (normalized[idx].fileSize || 0))
      if (!changed) return

      setGames(withSizes)
      vaporApi.games.save(withSizes)
    })
    vaporApi.settings.load().then(s => {
      const normalized = normalizeSettings(s)
      setSettings(normalized)
      applyTheme(normalized.theme)
    })
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
    const handleLaunchError = ({ id, error }) => {
      setRunning(r => {
        const n = { ...r }
        delete n[id]
        return n
      })
      if (error) window.alert(error)
    }
    vaporApi.on('game:launch-error', handleLaunchError)
    return () => vaporApi.off('game:launch-error', handleLaunchError)
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
    applyTheme(normalized.theme)
    vaporApi.settings.save(normalized)
  }, [])

  const launchGame = useCallback(async (game) => {
    setRunning(r => ({ ...r, [game.id]: true }))
    const result = await vaporApi.game.launch(game)
    if (!result.ok || result?.tracking === false) {
      setRunning(r => { const n={...r}; delete n[game.id]; return n })
    }
    if (!result.ok) {
      window.alert(result?.error || 'Failed to launch game.')
    }
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

  const openGameFolder = useCallback(async (game) => {
    const result = await vaporApi.game.openFolder(game)
    if (!result?.ok) {
      window.alert(result?.error || 'Unable to open the game folder.')
    }
  }, [])

  const showExecutable = useCallback(async (game) => {
    const result = await vaporApi.game.showExecutable(game)
    if (!result?.ok) {
      window.alert(result?.error || 'Unable to reveal the executable.')
    }
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
  const menuWidth = 280
  const menuX = Math.max(8, Math.min(contextMenu.x, window.innerWidth - menuWidth - 8))
  const menuY = Math.max(8, Math.min(contextMenu.y, window.innerHeight - 440))

  return (
    <>
      {showBoot && <BootAnimation onComplete={() => setShowBoot(false)} />}
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
              search={search}
              setSearch={setSearch}
              sortBy={librarySort}
              setSortBy={setLibrarySort}
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
              onOpenSettings={(game) => setSettingsPopup({ open: true, game })}
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
          {view === 'downloads' && <Downloader settings={settings} />}
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
            zIndex:1001,
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
              launchGame(menuGame)
              closeGameContextMenu()
            }}
            label="Play"
          />

          <MenuButton
            onClick={() => {
              setView('library')
              setSelected(menuGame)
              closeGameContextMenu()
            }}
            label="View Details"
          />

          <MenuButton
            onClick={() => {
              setSettingsPopup({ open: true, game: menuGame })
              closeGameContextMenu()
            }}
            label="Settings"
          />

          <MenuDivider />

          <MenuButton
            onClick={() => {
              openGameFolder(menuGame)
              closeGameContextMenu()
            }}
            label="Open Game Folder"
          />

          <MenuButton
            onClick={() => {
              showExecutable(menuGame)
              closeGameContextMenu()
            }}
            label="Show Executable In Folder"
          />

          <MenuDivider />

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
                        closeGameContextMenu()
                      }}
                      label={`${isIn ? '✓ ' : ''}${collection.name}`}
                    />
                  )
                })}
              </div>
            </>
          )}

          <MenuDivider />

          <MenuButton
            onClick={() => {
              removeGame(menuGame.id)
              closeGameContextMenu()
            }}
            label="Remove From Library"
            tone="danger"
          />
        </div>
      )}

      {settingsPopup.open && settingsPopup.game && (
        <div
          onClick={() => setSettingsPopup({ open: false, game: null })}
          style={{
            position:'fixed',
            inset:0,
            background:'#00000080',
            backdropFilter:'blur(4px)',
            zIndex:2000,
            display:'flex',
            alignItems:'center',
            justifyContent:'center',
            padding:20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width:'100%',
              maxWidth:600,
              maxHeight:'90vh',
              background:'var(--surface)',
              border:'1px solid var(--border2)',
              borderRadius:12,
              overflow:'hidden',
              boxShadow:'0 24px 60px #00000090',
            }}
          >
            <GameSettings
              game={settingsPopup.game}
              collections={settings.collections}
              onBack={() => setSettingsPopup({ open: false, game: null })}
              onUpdate={updateGame}
              onRemove={(id) => {
                removeGame(id)
                setSettingsPopup({ open: false, game: null })
              }}
              onToggleFavorite={toggleFavorite}
              onToggleCollection={toggleCollection}
            />
          </div>
        </div>
      )}
    </div>
    </>
  )
}

function MenuButton({ label, onClick, tone = 'default' }) {
  const isDanger = tone === 'danger'
  const baseColor = isDanger ? 'var(--red)' : 'var(--text-dim)'
  const hoverColor = isDanger ? '#fca5a5' : 'var(--text)'
  const hoverBg = isDanger ? '#f8717115' : 'var(--surface2)'
  return (
    <button
      onClick={onClick}
      style={{
        width:'100%',
        textAlign:'left',
        padding:'8px 12px',
        fontSize:12,
        color: baseColor,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = hoverBg
        e.currentTarget.style.color = hoverColor
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = baseColor
      }}
    >
      {label}
    </button>
  )
}

function MenuDivider() {
  return <div style={{ height:1, background:'var(--border)', margin:'4px 0' }} />
}
