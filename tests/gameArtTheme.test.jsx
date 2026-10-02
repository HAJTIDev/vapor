import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { hashString, getGameTheme, getGameMonogram, detectGenreIcon, PALETTES } from '../src/gameArtTheme.js'
import GameCoverArt from '../src/components/GameCoverArt.jsx'

describe('Game Art Theme & Procedural Poster Engine', () => {
  it('deterministically hashes game titles to consistent palettes', () => {
    const hash1 = hashString('Cyberpunk 2077')
    const hash2 = hashString('Cyberpunk 2077')
    expect(hash1).toBe(hash2)
    expect(typeof hash1).toBe('number')

    const theme1 = getGameTheme({ name: 'Cyberpunk 2077' })
    const theme2 = getGameTheme({ name: 'Cyberpunk 2077' })
    expect(theme1.id).toBe(theme2.id)
    expect(theme1.accent).toBe(theme2.accent)
  })

  it('generates diverse palettes across different games', () => {
    const t1 = getGameTheme({ name: 'DOOM Eternal' })
    const t2 = getGameTheme({ name: 'Half-Life 2' })
    const t3 = getGameTheme({ name: 'Witcher 3' })

    const ids = new Set([t1.id, t2.id, t3.id])
    expect(ids.size).toBeGreaterThanOrEqual(2)
  })

  it('generates smart monograms for various title formats', () => {
    expect(getGameMonogram('Cyberpunk 2077')).toBe('CP')
    expect(getGameMonogram('Grand Theft Auto V')).toBe('GTA')
    expect(getGameMonogram('Half-Life 2')).toBe('HL2')
    expect(getGameMonogram('The Witcher')).toBe('WIT')
    expect(getGameMonogram('Portal')).toBe('POR')
  })

  it('detects genre icons and badges properly', () => {
    const vrGame = detectGenreIcon({ isVR: true })
    expect(vrGame?.icon).toBe('vr')

    const shooter = detectGenreIcon({ name: 'Counter-Strike 2' })
    expect(shooter?.icon).toBe('crosshair')

    const racing = detectGenreIcon({ name: 'Forza Horizon' })
    expect(racing?.icon).toBe('racing')

    const rpg = detectGenreIcon({ name: 'Elden Ring' })
    expect(rpg?.icon).toBe('sword')
  })

  it('renders GameCoverArt with image when grid art exists', () => {
    const html = renderToString(
      <GameCoverArt
        game={{ name: 'Sample Game' }}
        src="https://example.com/cover.jpg"
        alt="Sample Game"
        variant="card"
      />
    )
    expect(html).toContain('<img')
    expect(html).toContain('https://example.com/cover.jpg')
  })

  it('renders high-end procedural poster when artwork is missing', () => {
    const html = renderToString(
      <GameCoverArt
        game={{ name: 'Super Metroid', genres: ['Action'] }}
        src={null}
        variant="card"
      />
    )
    expect(html).toContain('game-poster-fallback')
    expect(html).toContain('Super Metroid')
    expect(html).toContain('VAULT')
    expect(html).not.toContain('No Artwork') // Never shows ugly placeholder label
  })

  it('renders hero fallback banner when hero art is missing', () => {
    const html = renderToString(
      <GameCoverArt
        game={{ name: 'Dark Souls', genres: ['RPG'] }}
        src={null}
        variant="hero"
      />
    )
    expect(html).toContain('game-hero-fallback')
  })

  it('renders sidebar thumb with monogram', () => {
    const html = renderToString(
      <GameCoverArt
        game={{ name: 'Terraria' }}
        src={null}
        variant="thumb"
      />
    )
    expect(html).toContain('game-thumb-fallback')
    expect(html).toContain('TE')
  })
})
