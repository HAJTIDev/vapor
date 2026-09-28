import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Titlebar from './components/Titlebar.jsx'
import Sidebar from './components/Sidebar.jsx'
import Library from './components/Library.jsx'
import GameDetail from './components/GameDetail.jsx'
import GameSettings from './components/GameSettings.jsx'
import Settings from './components/Settings.jsx'
import AddGames from './components/AddGames.jsx'
import Downloader from './components/Downloader.jsx'
import GamepadBar from './components/GamepadBar.jsx'
import { useGamepad, vibrateGamepad } from './useGamepad.js'
import vaporApi from './vaporApi.js'
import { applyTheme, applyCustomThemeCss } from './themes.js'
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
    autoScanAllDrives: false,
    gamepadVibration: true,
    gamepadHud: true,
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

export function isGameVR(game) {
  if (!game) return false
  if (game.isVR === true) return true
  if (game.isVR === false) return false
  if (Array.isArray(game.genres) && game.genres.some(g => String(g).trim().toLowerCase() === 'vr')) return true
  const name = String(game.name || '').toLowerCase()
  const exe = String(game.exeName || game.exe || '').toLowerCase()
  const vrWordRegex = /(?:^|[_\s.\-/(])vr(?:[_\s.\-/)!]|$)/i
  if (vrWordRegex.test(name) || vrWordRegex.test(exe)) return true
  if (/virtual[\s_-]?reality/i.test(name) || /steamvr/i.test(name) || /openxr/i.test(name) || /beat[\s_-]?saber/i.test(name) || /half[\s_-]?life[:\s_-]*alyx/i.test(name) || /hlvr/i.test(exe) || /\balyx\b/i.test(name) || /boneworks/i.test(name) || /bonelab/i.test(name) || /blade.*sorcery/i.test(name) || /blade.*sorcery/i.test(exe) || /pavlov/i.test(name) || /into[\s_-]the[\s_-]radius/i.test(name)) return true
  return false
}

export function normalizeGame(input) {
  const safe = input || {}
  const isVR = safe.isVR !== undefined ? !!safe.isVR : isGameVR(safe)
  let existingGenres = Array.isArray(safe.genres) ? [...safe.genres] : []
  if (isVR && !existingGenres.some(g => String(g).toLowerCase() === 'vr')) {
    existingGenres.push('VR')
  } else if (!isVR) {
    existingGenres = existingGenres.filter(g => String(g).toLowerCase() !== 'vr')
  }
  return {
    ...safe,
    isVR,
    genres: existingGenres,
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

function resolveCustomThemeCss(themeId, themeList) {
  if (!String(themeId || '').startsWith('custom:')) return ''
  const match = (themeList || []).find((theme) => theme?.id === themeId)
  return match?.css || ''
}

export default function App() {
  const [games, setGames]           = useState([])
  const [settings, setSettings]     = useState(defaultSettings)
  const [customThemes, setCustomThemes] = useState([])
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
  const [updateToast, setUpdateToast] = useState(null)

  const refreshCustomThemes = useCallback(async (themeIdToApply = settings.theme) => {
    const result = await vaporApi.themes.listCustom()
    const nextThemes = result?.ok && Array.isArray(result.themes) ? result.themes : []
    setCustomThemes(nextThemes)

    applyCustomThemeCss(resolveCustomThemeCss(themeIdToApply, nextThemes))

    return result
  }, [settings.theme])

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
      refreshCustomThemes(normalized.theme)
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
    const handleRunningStarted = ({ id }) => {
      if (!id) return
      setRunning(r => ({ ...r, [id]: true }))
    }

    const handleRunningStopped = ({ id }) => {
      if (!id) return
      setRunning(r => {
        const n = { ...r }
        delete n[id]
        return n
      })
    }

    vaporApi.on('game:running-started', handleRunningStarted)
    vaporApi.on('game:running-stopped', handleRunningStopped)

    return () => {
      vaporApi.off('game:running-started', handleRunningStarted)
      vaporApi.off('game:running-stopped', handleRunningStopped)
    }
  }, [])

  useEffect(() => {
    const valid = new Set(settings.collections.map(c => c.id))
    if (activeCollection !== 'all' && activeCollection !== 'favorites' && activeCollection !== 'vr' && !valid.has(activeCollection)) {
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

  useEffect(() => {
    const handleUpdateStatus = (data) => {
      if (data?.status !== 'available') return
      setUpdateToast({ version: data.version || null })
    }
    vaporApi.on('update:status', handleUpdateStatus)
    return () => vaporApi.off('update:status', handleUpdateStatus)
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
    applyCustomThemeCss(resolveCustomThemeCss(normalized.theme, customThemes))
    vaporApi.settings.save(normalized)
  }, [customThemes])

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

  const wipeGames = useCallback(() => {
    const yes = window.confirm('Remove all games from Vapor? This only clears the app library. Game files on disk will stay untouched.')
    if (!yes) return

    setSelected(null)
    setGames([])
    vaporApi.games.save([])
  }, [])

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
    if (activeCollection === 'vr') return isGameVR(game)
    return (game.collections || []).includes(activeCollection)
  }, [activeCollection])

  const searchFilteredGames = games.filter(g => {
    if (!search) return true
    return g.name.toLowerCase().includes(search.toLowerCase())
  })

  const collectionFilteredGames = searchFilteredGames.filter(matchesCollection)
  const visibleGames = sortGames(collectionFilteredGames, settings.ui.sidebarSort)

  const libraryGames = useMemo(() => {
    let list = collectionFilteredGames
    if (filterGenre !== 'all') {
      list = list.filter(g => (g.genres || []).includes(filterGenre))
    }
    if (librarySort === 'name') {
      return [...list].sort((a, b) => a.name.localeCompare(b.name))
    }
    if (librarySort === 'playtime') {
      return [...list].sort((a, b) => (b.playtime || 0) - (a.playtime || 0))
    }
    if (librarySort === 'added') {
      return [...list].sort((a, b) => (+b.id || 0) - (+a.id || 0))
    }
    return [...list].sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0))
  }, [collectionFilteredGames, filterGenre, librarySort])

  const vrGamesCount = useMemo(() => games.filter(isGameVR).length, [games])

  const collectionItems = [
    { id: 'all', name: 'All Games', count: games.length, icon: '🎮' },
    { id: 'favorites', name: 'Favorites', count: games.filter(g => g.favorite).length, icon: '★' },
    { id: 'vr', name: 'VR Games', count: vrGamesCount, icon: '🥽' },
    ...settings.collections.map(c => ({
      ...c,
      count: games.filter(g => (g.collections || []).includes(c.id)).length,
    })),
  ]

  const triggerHaptic = useCallback((type) => {
    vibrateGamepad(type, settings.ui?.gamepadVibration ?? true)
  }, [settings.ui?.gamepadVibration])

  const cycleCollection = useCallback((direction = 'next') => {
    if (!collectionItems.length) return
    const curIdx = collectionItems.findIndex(c => c.id === activeCollection)
    let nextIdx
    if (direction === 'next') {
      nextIdx = curIdx >= 0 ? (curIdx + 1) % collectionItems.length : 0
    } else {
      nextIdx = curIdx > 0 ? curIdx - 1 : collectionItems.length - 1
    }
    const target = collectionItems[nextIdx]
    if (target) {
      setActiveCollection(target.id)
      setSelected(null)
      setFilterGenre('all')
      setGamepadGameIndex(0)
      triggerHaptic('click')
    }
  }, [collectionItems, activeCollection, triggerHaptic])

  const toggleVrCollection = useCallback(() => {
    const nextId = activeCollection === 'vr' ? 'all' : 'vr'
    setActiveCollection(nextId)
    setSelected(null)
    setFilterGenre('all')
    setGamepadGameIndex(0)
    triggerHaptic('click')
  }, [activeCollection, triggerHaptic])

  const selectedGame = selected ? games.find(g => g.id === selected.id) || selected : null
  const menuGame = contextMenu.open ? games.find(g => g.id === contextMenu.gameId) : null
  const menuWidth = 280
  const menuX = Math.max(8, Math.min(contextMenu.x, window.innerWidth - menuWidth - 8))
  const menuY = Math.max(8, Math.min(contextMenu.y, window.innerHeight - 440))

  // Gamepad navigation state
  const [gamepadGameIndex, setGamepadGameIndex] = useState(0)
  const [gamepadDetailActionIndex, setGamepadDetailActionIndex] = useState(0)

  useEffect(() => {
    if (libraryGames.length > 0 && gamepadGameIndex >= libraryGames.length) {
      setGamepadGameIndex(Math.max(0, libraryGames.length - 1))
    }
  }, [libraryGames.length, gamepadGameIndex])

  const handleGamepadNavigate = useCallback((direction) => {
    if (view === 'library') {
      if (!selected) {
        setGamepadGameIndex(prev => {
          const total = libraryGames.length
          if (total === 0) return 0

          // Calculate EXACT number of columns from layout engine
          let cols = 1
          const grid = document.querySelector('.library-grid')
          if (grid) {
            try {
              const computed = window.getComputedStyle(grid).gridTemplateColumns
              if (computed && computed !== 'none') {
                const count = computed.trim().split(/\s+/).filter(Boolean).length
                if (count > 0) cols = count
              }
            } catch {
              // fallback below
            }

            if (cols <= 1) {
              const cards = grid.querySelectorAll('.game-card')
              if (cards.length > 1) {
                const firstTop = cards[0].offsetTop
                let count = 0
                for (let i = 0; i < cards.length; i++) {
                  if (Math.abs(cards[i].offsetTop - firstTop) < 60) {
                    count++
                  } else {
                    break
                  }
                }
                if (count > 0) cols = count
              }
            }
          }

          if (direction === 'right') {
            return Math.min(total - 1, prev + 1)
          }

          if (direction === 'left') {
            return Math.max(0, prev - 1)
          }

          if (direction === 'down') {
            const target = prev + cols
            if (target < total) {
              return target
            }
            const currentRow = Math.floor(prev / cols)
            const lastRow = Math.floor((total - 1) / cols)
            if (currentRow < lastRow) {
              return total - 1
            }
            return prev
          }

          if (direction === 'up') {
            const target = prev - cols
            if (target >= 0) {
              return target
            }
            return prev
          }

          return prev
        })
      } else {
        setGamepadDetailActionIndex(prev => {
          if (direction === 'down' || direction === 'right') return Math.min(5, prev + 1)
          if (direction === 'up' || direction === 'left') return Math.max(0, prev - 1)
          return prev
        })
      }
    }
  }, [view, selected, libraryGames.length])

  const handleGamepadButtonPress = useCallback((button) => {
    const viewsList = ['library', 'add', 'downloads', 'settings']
    const curIdx = viewsList.indexOf(view)

    if (button === 'RT') {
      if (view !== 'library') setView('library')
      cycleCollection('next')
      return
    }

    if (button === 'LT') {
      if (view !== 'library') setView('library')
      cycleCollection('prev')
      return
    }

    if (button === 'RB') {
      const next = viewsList[(curIdx + 1) % viewsList.length]
      setView(next)
      setSelected(null)
      triggerHaptic('click')
      return
    }

    if (button === 'LB') {
      const prev = viewsList[(curIdx - 1 + viewsList.length) % viewsList.length]
      setView(prev)
      setSelected(null)
      triggerHaptic('click')
      return
    }

    if (button === 'Start') {
      if (selected) {
        setSettingsPopup({ open: true, game: selected })
      } else {
        setView(v => v === 'settings' ? 'library' : 'settings')
      }
      triggerHaptic('click')
      return
    }

    if (button === 'B') {
      if (contextMenu.open) {
        closeGameContextMenu()
        triggerHaptic('click')
        return
      }
      if (settingsPopup.open) {
        setSettingsPopup({ open: false, game: null })
        triggerHaptic('click')
        return
      }
      if (selected) {
        setSelected(null)
        triggerHaptic('click')
        return
      }
      if (view !== 'library') {
        setView('library')
        triggerHaptic('click')
        return
      }
    }

    if (view === 'library') {
      if (!selected) {
        if (button === 'Select') {
          toggleVrCollection()
          return
        }

        const game = libraryGames[gamepadGameIndex]
        if (!game) return

        if (button === 'A') {
          setSelected(game)
          triggerHaptic('click')
        } else if (button === 'Y') {
          launchGame(game)
          triggerHaptic('launch')
        } else if (button === 'X') {
          toggleFavorite(game.id)
          triggerHaptic('favorite')
        } else if (button === 'R3') {
          const nextVR = !isGameVR(game)
          let nextGenres = Array.isArray(game.genres) ? [...game.genres] : []
          if (nextVR && !nextGenres.some(g => String(g).toLowerCase() === 'vr')) {
            nextGenres.push('VR')
          } else if (!nextVR) {
            nextGenres = nextGenres.filter(g => String(g).toLowerCase() !== 'vr')
          }
          updateGame(game.id, { isVR: nextVR, genres: nextGenres })
          triggerHaptic('favorite')
        }
      } else {
        // GameDetail view
        if (button === 'Select' || button === 'R3') {
          const nextVR = !isGameVR(selected)
          let nextGenres = Array.isArray(selected.genres) ? [...selected.genres] : []
          if (nextVR && !nextGenres.some(g => String(g).toLowerCase() === 'vr')) {
            nextGenres.push('VR')
          } else if (!nextVR) {
            nextGenres = nextGenres.filter(g => String(g).toLowerCase() !== 'vr')
          }
          updateGame(selected.id, { isVR: nextVR, genres: nextGenres })
          triggerHaptic('favorite')
          return
        }

        if (button === 'Y') {
          launchGame(selected)
          triggerHaptic('launch')
        } else if (button === 'X') {
          toggleFavorite(selected.id)
          triggerHaptic('favorite')
        } else if (button === 'A') {
          if (gamepadDetailActionIndex === 0) {
            launchGame(selected)
            triggerHaptic('launch')
          } else if (gamepadDetailActionIndex === 1) {
            setSettingsPopup({ open: true, game: selected })
            triggerHaptic('click')
          } else if (gamepadDetailActionIndex === 2) {
            // Fetch art
            triggerHaptic('click')
          } else if (gamepadDetailActionIndex === 3) {
            toggleFavorite(selected.id)
            triggerHaptic('favorite')
          } else if (gamepadDetailActionIndex === 4) {
            const nextVR = !isGameVR(selected)
            let nextGenres = Array.isArray(selected.genres) ? [...selected.genres] : []
            if (nextVR && !nextGenres.some(g => String(g).toLowerCase() === 'vr')) {
              nextGenres.push('VR')
            } else if (!nextVR) {
              nextGenres = nextGenres.filter(g => String(g).toLowerCase() !== 'vr')
            }
            updateGame(selected.id, { isVR: nextVR, genres: nextGenres })
            triggerHaptic('click')
          } else if (gamepadDetailActionIndex === 5) {
            removeGame(selected.id)
            triggerHaptic('click')
          }
        }
      }
    }
  }, [view, selected, libraryGames, gamepadGameIndex, gamepadDetailActionIndex, contextMenu.open, settingsPopup.open, closeGameContextMenu, launchGame, toggleFavorite, removeGame, triggerHaptic, cycleCollection, toggleVrCollection, updateGame])

  const { isGamepadActive, gamepadInfo } = useGamepad({
    onNavigate: handleGamepadNavigate,
    onButtonPress: handleGamepadButtonPress,
    vibrationEnabled: settings.ui?.gamepadVibration ?? true,
  })

  return (
    <>
      {showBoot && <BootAnimation onComplete={() => setShowBoot(false)} />}
      <div className="app-shell" style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>
      <Titlebar gamepadName={gamepadInfo?.id || null} />
      <div className="app-body" style={{ display:'flex', flex:1, overflow:'hidden' }}>
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
        <main className="app-main" style={{ flex:1, overflow:'hidden', position:'relative' }}>
          {view === 'library' && !selectedGame && (
            <Library
              games={libraryGames}
              allCollectionGames={collectionFilteredGames}
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
              onToggleFavorite={toggleFavorite}
              onAddClick={() => setView('add')}
              gamepadFocusedIndex={isGamepadActive ? gamepadGameIndex : null}
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
              gamepadActionIndex={isGamepadActive ? gamepadDetailActionIndex : null}
            />
          )}
          {view === 'settings' && (
            <Settings
              settings={settings}
              onSave={saveSettings}
              games={games}
              onWipeGames={wipeGames}
              onRefreshAllArt={refreshAllArt}
              customThemes={customThemes}
              onRefreshCustomThemes={refreshCustomThemes}
              onOpenCustomThemesFolder={() => vaporApi.themes.openCustomFolder()}
            />
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
          className="context-menu"
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

          <MenuButton
            onClick={() => {
              const currentIsVr = isGameVR(menuGame)
              const nextIsVr = !currentIsVr
              let nextGenres = Array.isArray(menuGame.genres) ? [...menuGame.genres] : []
              if (nextIsVr && !nextGenres.some(g => String(g).toLowerCase() === 'vr')) {
                nextGenres.push('VR')
              } else if (!nextIsVr) {
                nextGenres = nextGenres.filter(g => String(g).toLowerCase() !== 'vr')
              }
              updateGame(menuGame.id, { isVR: nextIsVr, genres: nextGenres })
              closeGameContextMenu()
            }}
            label={isGameVR(menuGame) ? '🥽 Remove From VR Games' : '🥽 Mark As VR Game'}
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

      {updateToast && (
        <div style={{
          position: 'fixed',
          top: 56,
          right: 16,
          width: 340,
          maxWidth: 'calc(100vw - 24px)',
          background: 'color-mix(in srgb, var(--surface) 92%, black 8%)',
          border: '1px solid var(--border2)',
          borderLeft: '3px solid var(--accent)',
          borderRadius: 10,
          boxShadow: '0 16px 36px #00000066',
          zIndex: 2100,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Update available</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {updateToast.version ? `Version ${updateToast.version} is ready to download.` : 'A new version is ready to download.'}
              </div>
            </div>
            <button
              onClick={() => setUpdateToast(null)}
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                color: 'var(--text-muted)',
                fontSize: 12,
                lineHeight: '20px',
                textAlign: 'center',
                flexShrink: 0,
              }}
              title="Dismiss"
            >
              x
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => {
                vaporApi.update.download()
                setUpdateToast(null)
              }}
              style={{
                padding: '7px 12px',
                borderRadius: 7,
                fontSize: 12,
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
              }}
            >
              Download
            </button>
            <button
              onClick={() => {
                setView('settings')
                setSelected(null)
                setUpdateToast(null)
              }}
              style={{
                padding: '7px 12px',
                borderRadius: 7,
                fontSize: 12,
                background: 'var(--surface2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
              }}
            >
              Open Updates
            </button>
          </div>
        </div>
      )}

      <GamepadBar
        isVisible={isGamepadActive && (settings.ui?.gamepadHud ?? true)}
        view={view}
        selectedGame={selectedGame}
        activeCollection={activeCollection}
        gamepadName={gamepadInfo?.id || null}
      />
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
