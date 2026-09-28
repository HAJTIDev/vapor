import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'

// Provide minimal browser mocks for SSR / node environment test
globalThis.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  innerWidth: 1280,
  innerHeight: 800,
  open: () => {},
}
globalThis.document = {
  documentElement: { setAttribute: () => {}, getAttribute: () => null },
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
  addEventListener: () => {},
  removeEventListener: () => {},
}
Object.defineProperty(globalThis, 'navigator', {
  value: { getGamepads: () => [] },
  configurable: true,
})

import App from '../src/App.jsx'
import Library from '../src/components/Library.jsx'
import GameDetail from '../src/components/GameDetail.jsx'
import GamepadBar from '../src/components/GamepadBar.jsx'
import Titlebar from '../src/components/Titlebar.jsx'

describe('Smoke test component rendering', () => {
  it('renders Library without throwing', () => {
    const html = renderToString(
      <Library
        games={[
          { id: '1', name: 'Test Game', playtime: 60, hltb: { main: '10h' } }
        ]}
        totalGameCount={1}
        running={{}}
        search=""
        setSearch={() => {}}
        sortBy="recent"
        setSortBy={() => {}}
        activeCollection="all"
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
    expect(html).toContain('Test Game')
    expect(html).toContain('10h')
  })

  it('renders GameDetail without throwing', () => {
    const html = renderToString(
      <GameDetail
        game={{
          id: '1',
          name: 'Cyberpunk 2077',
          playtime: 120,
          hltb: { main: '25h', extra: '60h', completionist: '104h' }
        }}
        running={false}
        collections={[]}
        onBack={() => {}}
        onLaunch={() => {}}
        onUpdate={() => {}}
        onRemove={() => {}}
        onToggleFavorite={() => {}}
      />
    )
    expect(html).toContain('Cyberpunk 2077')
    expect(html).toContain('25h')
  })

  it('renders GamepadBar without throwing', () => {
    const html = renderToString(
      <GamepadBar isVisible={true} view="library" selectedGame={null} gamepadName="Xbox Controller" />
    )
    expect(html).toContain('Xbox Controller')
    expect(html).toContain('Szczegóły')
  })

  it('renders Titlebar without throwing', () => {
    const html = renderToString(
      <Titlebar gamepadName="Xbox Wireless Controller" />
    )
    expect(html).toContain('VAPOR')
  })

  it('renders App without throwing ReferenceError or TypeError', () => {
    const html = renderToString(<App />)
    expect(html).toContain('VAPOR')
  })
})
