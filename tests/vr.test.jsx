import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { isGameVR, normalizeGame } from '../src/App.jsx'
import { detectVrGame } from '../main/scanner.js'
import Library from '../src/components/Library.jsx'
import GameDetail from '../src/components/GameDetail.jsx'
import Sidebar from '../src/components/Sidebar.jsx'
import GamepadBar from '../src/components/GamepadBar.jsx'

describe('VR Detection & Normalization', () => {
  it('detectVrGame correctly identifies VR titles by name and exe', () => {
    expect(detectVrGame(null, 'Half-Life: Alyx', 'hlvr.exe')).toBe(true)
    expect(detectVrGame(null, 'Beat Saber', 'Beat Saber.exe')).toBe(true)
    expect(detectVrGame(null, 'Superhot VR', 'SUPERHOTVR.exe')).toBe(true)
    expect(detectVrGame(null, 'Boneworks', 'BONEWORKS.exe')).toBe(true)
    expect(detectVrGame(null, 'Blade & Sorcery', 'BladeAndSorcery.exe')).toBe(true)
    expect(detectVrGame(null, 'Pavlov VR', 'Pavlov-Win64-Shipping.exe')).toBe(true)
    expect(detectVrGame(null, 'Into The Radius VR', 'IntoTheRadius.exe')).toBe(true)
    expect(detectVrGame(null, 'Cyberpunk 2077', 'Cyberpunk2077.exe')).toBe(false)
    expect(detectVrGame(null, 'Hollow Knight', 'hollow_knight.exe')).toBe(false)
  })

  it('isGameVR correctly identifies VR games from various signals', () => {
    expect(isGameVR({ isVR: true, name: 'Custom VR Game' })).toBe(true)
    expect(isGameVR({ isVR: false, name: 'Beat Saber' })).toBe(false) // Explicit user override respected
    expect(isGameVR({ name: 'Beat Saber' })).toBe(true)
    expect(isGameVR({ name: 'Half-Life Alyx' })).toBe(true)
    expect(isGameVR({ name: 'Standard Game', genres: ['Action', 'VR', 'Shooter'] })).toBe(true)
    expect(isGameVR({ name: 'Standard Game', genres: ['Action', 'RPG'] })).toBe(false)
    expect(isGameVR({ name: 'Standard Game', exeName: 'game_vr.exe' })).toBe(true)
  })

  it('normalizeGame ensures isVR and genres are properly populated', () => {
    const vrGame = normalizeGame({ id: '1', name: 'Beat Saber', exe: 'C:/games/beatsaber.exe' })
    expect(vrGame.isVR).toBe(true)
    expect(vrGame.genres).toContain('VR')

    const regularGame = normalizeGame({ id: '2', name: 'Hades', exe: 'C:/games/hades.exe' })
    expect(regularGame.isVR).toBe(false)
    expect(regularGame.genres).not.toContain('VR')

    const unmarkVr = normalizeGame({ id: '3', name: 'Beat Saber', isVR: false, genres: ['VR', 'Rhythm'] })
    expect(unmarkVr.isVR).toBe(false)
    expect(unmarkVr.genres).not.toContain('VR')
  })
})

describe('VR UI Rendering', () => {
  it('renders VR Games collection header and VR badge on GameCard in Library', () => {
    const vrGame = {
      id: 'vr-1',
      name: 'Half-Life: Alyx',
      isVR: true,
      genres: ['VR', 'Action'],
      playtime: 150,
      hltb: { main: '12h' }
    }

    const html = renderToString(
      <Library
        games={[vrGame]}
        allCollectionGames={[vrGame]}
        totalGameCount={1}
        running={{}}
        search=""
        setSearch={() => {}}
        sortBy="recent"
        setSortBy={() => {}}
        activeCollection="vr"
        filterGenre="all"
        setFilterGenre={() => {}}
        onBrowseAllGames={() => {}}
        onSelect={() => {}}
        onLaunch={() => {}}
        onGameContextMenu={() => {}}
        onToggleFavorite={() => {}}
        onAddClick={() => {}}
        gamepadFocusedIndex={0}
      />
    )

    expect(html).toContain('VR Games 🥽')
    expect(html).toContain('Half-Life: Alyx')
    expect(html).toContain('12h')
    expect(html).toContain('VR')
  })

  it('renders empty state for VR Games when no VR games match', () => {
    const html = renderToString(
      <Library
        games={[]}
        allCollectionGames={[]}
        totalGameCount={5}
        running={{}}
        search=""
        setSearch={() => {}}
        sortBy="recent"
        setSortBy={() => {}}
        activeCollection="vr"
        filterGenre="all"
        setFilterGenre={() => {}}
        onBrowseAllGames={() => {}}
        onSelect={() => {}}
        onLaunch={() => {}}
        onGameContextMenu={() => {}}
        onToggleFavorite={() => {}}
        onAddClick={() => {}}
        gamepadFocusedIndex={null}
      />
    )

    expect(html).toContain('No VR games found')
    expect(html).toContain('Browse All Games')
  })

  it('renders VR Badge and VR Toggle in GameDetail', () => {
    const vrGame = {
      id: 'vr-1',
      name: 'Beat Saber',
      isVR: true,
      genres: ['VR', 'Rhythm'],
      playtime: 300,
    }

    const html = renderToString(
      <GameDetail
        game={vrGame}
        running={false}
        collections={[]}
        onBack={() => {}}
        onLaunch={() => {}}
        onUpdate={() => {}}
        onRemove={() => {}}
        onToggleFavorite={() => {}}
      />
    )

    expect(html).toContain('Virtual Reality Game')
    expect(html).toContain('VR Game (Enabled)')
  })

  it('renders VR Games category item in Sidebar with custom icon and count', () => {
    const collections = [
      { id: 'all', name: 'All Games', count: 10, icon: '🎮' },
      { id: 'favorites', name: 'Favorites', count: 2, icon: '★' },
      { id: 'vr', name: 'VR Games', count: 3, icon: '🥽' },
    ]

    const html = renderToString(
      <Sidebar
        view="library"
        setView={() => {}}
        gameCount={10}
        search=""
        setSearch={() => {}}
        onDeselect={() => {}}
        collections={collections}
        activeCollection="vr"
        onCollectionSelect={() => {}}
        games={[]}
        selectedGameId={null}
        onSelectGame={() => {}}
        onLaunch={() => {}}
        onGameContextMenu={() => {}}
        running={{}}
        showSidebarPlaytime={true}
        compactSidebar={false}
      />
    )

    expect(html).toContain('VR Games')
    expect(html).toContain('🥽')
  })

  it('renders GamepadBar with VR category switch prompts for controller', () => {
    // 1. In standard library view on "All Games" -> Shows prompt to switch to VR Games
    const htmlAll = renderToString(
      <GamepadBar
        isVisible={true}
        view="library"
        selectedGame={null}
        activeCollection="all"
        gamepadName="Xbox Wireless Controller"
      />
    )
    expect(htmlAll).toContain('LT')
    expect(htmlAll).toContain('RT')
    expect(htmlAll).toContain('Kategorie')
    expect(htmlAll).toContain('Select')
    expect(htmlAll).toContain('Gry VR 🥽')

    // 2. In VR Games category -> Shows prompt to switch to All Games
    const htmlVr = renderToString(
      <GamepadBar
        isVisible={true}
        view="library"
        selectedGame={null}
        activeCollection="vr"
        gamepadName="Meta Quest Touch Plus"
      />
    )
    expect(htmlVr).toContain('Wszystkie Gry 🎮')
    expect(htmlVr).toContain('🥽 VR')

    // 3. In GameDetail -> Shows prompt to toggle VR status
    const htmlDetail = renderToString(
      <GamepadBar
        isVisible={true}
        view="library"
        selectedGame={{ id: '1', name: 'HL Alyx', isVR: true }}
        activeCollection="vr"
        gamepadName="Controller"
      />
    )
    expect(htmlDetail).toContain('Select')
    expect(htmlDetail).toContain('Wyłącz VR')
  })
})

