/**
 * Vapor Procedural Game Art Engine
 * Generates beautiful, deterministic, personalized cover posters and hero backdrops
 * for games without artwork.
 */

// Simple deterministic hash function
export function hashString(str) {
  let hash = 0
  const s = String(str || '')
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) & 0xffffffff
  }
  return Math.abs(hash)
}

export const PALETTES = [
  {
    id: 'cyber-neon',
    name: 'Cyberpunk Neon',
    bg: 'radial-gradient(ellipse at 50% 15%, #1e113f 0%, #0d0a1e 55%, #05040a 100%)',
    heroBg: 'radial-gradient(ellipse at 30% 20%, #291456 0%, #110926 50%, #06030c 100%)',
    accent: '#06b6d4',
    accent2: '#f43f5e',
    glow: 'rgba(6, 182, 212, 0.45)',
    badge: 'CYBERPUNK',
    pattern: 'circuits',
    icon: 'controller',
  },
  {
    id: 'molten-core',
    name: 'Molten Core',
    bg: 'radial-gradient(ellipse at 50% 15%, #2a1106 0%, #150802 55%, #070301 100%)',
    heroBg: 'radial-gradient(ellipse at 30% 20%, #3a1708 0%, #1c0a03 50%, #090301 100%)',
    accent: '#f97316',
    accent2: '#facc15',
    glow: 'rgba(249, 115, 22, 0.45)',
    badge: 'ACTION',
    pattern: 'hexagons',
    icon: 'crosshair',
  },
  {
    id: 'abyssal-blue',
    name: 'Abyssal Blue',
    bg: 'radial-gradient(ellipse at 50% 15%, #0d1e3d 0%, #061021 55%, #02060e 100%)',
    heroBg: 'radial-gradient(ellipse at 30% 20%, #132a54 0%, #09172f 50%, #030812 100%)',
    accent: '#38bdf8',
    accent2: '#818cf8',
    glow: 'rgba(56, 189, 248, 0.45)',
    badge: 'SCI-FI',
    pattern: 'isometric',
    icon: 'rocket',
  },
  {
    id: 'emerald-relic',
    name: 'Emerald Relic',
    bg: 'radial-gradient(ellipse at 50% 15%, #0c2b1e 0%, #05160f 55%, #020805 100%)',
    heroBg: 'radial-gradient(ellipse at 30% 20%, #113c2a 0%, #082016 50%, #020a07 100%)',
    accent: '#10b981',
    accent2: '#34d399',
    glow: 'rgba(16, 185, 129, 0.45)',
    badge: 'ADVENTURE',
    pattern: 'waves',
    icon: 'sword',
  },
  {
    id: 'crimson-protocol',
    name: 'Crimson Protocol',
    bg: 'radial-gradient(ellipse at 50% 15%, #2c0b13 0%, #170509 55%, #080204 100%)',
    heroBg: 'radial-gradient(ellipse at 30% 20%, #3e0f1b 0%, #1f070d 50%, #0a0204 100%)',
    accent: '#ef4444',
    accent2: '#fb7185',
    glow: 'rgba(239, 68, 68, 0.45)',
    badge: 'COMBAT',
    pattern: 'chevrons',
    icon: 'crosshair',
  },
  {
    id: 'royal-arcane',
    name: 'Royal Arcane',
    bg: 'radial-gradient(ellipse at 50% 15%, #240d3f 0%, #130624 55%, #06020c 100%)',
    heroBg: 'radial-gradient(ellipse at 30% 20%, #34135b 0%, #1a0831 50%, #080310 100%)',
    accent: '#a855f7',
    accent2: '#c084fc',
    glow: 'rgba(168, 85, 247, 0.45)',
    badge: 'FANTASY',
    pattern: 'rings',
    icon: 'sword',
  },
  {
    id: 'solar-flare',
    name: 'Solar Flare',
    bg: 'radial-gradient(ellipse at 50% 15%, #2b1407 0%, #170903 55%, #090301 100%)',
    heroBg: 'radial-gradient(ellipse at 30% 20%, #3d1b09 0%, #1f0c04 50%, #0a0401 100%)',
    accent: '#fb923c',
    accent2: '#fde047',
    glow: 'rgba(251, 146, 60, 0.45)',
    badge: 'ARCADE',
    pattern: 'mesh',
    icon: 'controller',
  },
  {
    id: 'titanium-core',
    name: 'Titanium Core',
    bg: 'radial-gradient(ellipse at 50% 15%, #1a202c 0%, #0f131a 55%, #06080b 100%)',
    heroBg: 'radial-gradient(ellipse at 30% 20%, #262e3f 0%, #141923 50%, #07090d 100%)',
    accent: '#94a3b8',
    accent2: '#38bdf8',
    glow: 'rgba(148, 163, 184, 0.35)',
    badge: 'TACTICAL',
    pattern: 'isometric',
    icon: 'controller',
  },
  {
    id: 'boreal-aurora',
    name: 'Boreal Aurora',
    bg: 'radial-gradient(ellipse at 50% 15%, #08262a 0%, #041416 55%, #010708 100%)',
    heroBg: 'radial-gradient(ellipse at 30% 20%, #0d383e 0%, #061d20 50%, #02090a 100%)',
    accent: '#14b8a6',
    accent2: '#22d3ee',
    glow: 'rgba(20, 184, 166, 0.45)',
    badge: 'INDIE',
    pattern: 'waves',
    icon: 'controller',
  },
  {
    id: 'cosmic-nebula',
    name: 'Cosmic Nebula',
    bg: 'radial-gradient(ellipse at 50% 15%, #180d38 0%, #0c061d 55%, #04020a 100%)',
    heroBg: 'radial-gradient(ellipse at 30% 20%, #231350 0%, #100827 50%, #05020c 100%)',
    accent: '#818cf8',
    accent2: '#e879f9',
    glow: 'rgba(129, 140, 248, 0.45)',
    badge: 'STELLAR',
    pattern: 'rings',
    icon: 'rocket',
  },
  {
    id: 'tokyo-drift',
    name: 'Tokyo Drift',
    bg: 'radial-gradient(ellipse at 50% 15%, #240b20 0%, #120410 55%, #060105 100%)',
    heroBg: 'radial-gradient(ellipse at 30% 20%, #350f2f 0%, #1a0617 50%, #080207 100%)',
    accent: '#f43f5e',
    accent2: '#facc15',
    glow: 'rgba(244, 63, 94, 0.45)',
    badge: 'RACING',
    pattern: 'chevrons',
    icon: 'racing',
  },
  {
    id: 'subzero-frost',
    name: 'Subzero Frost',
    bg: 'radial-gradient(ellipse at 50% 15%, #0b1e32 0%, #05101b 55%, #02060b 100%)',
    heroBg: 'radial-gradient(ellipse at 30% 20%, #112a45 0%, #081726 50%, #02070c 100%)',
    accent: '#38bdf8',
    accent2: '#a5f3fc',
    glow: 'rgba(56, 189, 248, 0.45)',
    badge: 'SURVIVAL',
    pattern: 'mesh',
    icon: 'crosshair',
  },
  {
    id: 'gothic-dusk',
    name: 'Gothic Dusk',
    bg: 'radial-gradient(ellipse at 50% 15%, #250914 0%, #13040a 55%, #060103 100%)',
    heroBg: 'radial-gradient(ellipse at 30% 20%, #350d1d 0%, #1b050f 50%, #080204 100%)',
    accent: '#e11d48',
    accent2: '#fda4af',
    glow: 'rgba(225, 29, 72, 0.45)',
    badge: 'HORROR',
    pattern: 'rings',
    icon: 'skull',
  },
  {
    id: 'golden-empire',
    name: 'Golden Empire',
    bg: 'radial-gradient(ellipse at 50% 15%, #291f09 0%, #151004 55%, #070501 100%)',
    heroBg: 'radial-gradient(ellipse at 30% 20%, #3b2c0d 0%, #1d1605 50%, #0a0702 100%)',
    accent: '#eab308',
    accent2: '#fde047',
    glow: 'rgba(234, 179, 8, 0.45)',
    badge: 'STRATEGY',
    pattern: 'hexagons',
    icon: 'strategy',
  },
  {
    id: 'synth-wave',
    name: 'Synthwave',
    bg: 'radial-gradient(ellipse at 50% 15%, #250d32 0%, #13061a 55%, #060209 100%)',
    heroBg: 'radial-gradient(ellipse at 30% 20%, #361348 0%, #1a0824 50%, #08020b 100%)',
    accent: '#ec4899',
    accent2: '#06b6d4',
    glow: 'rgba(236, 72, 153, 0.45)',
    badge: 'RETRO',
    pattern: 'circuits',
    icon: 'controller',
  },
  {
    id: 'cyber-matrix',
    name: 'Cyber Matrix',
    bg: 'radial-gradient(ellipse at 50% 15%, #092410 0%, #041308 55%, #010603 100%)',
    heroBg: 'radial-gradient(ellipse at 30% 20%, #0e3417 0%, #061c0c 50%, #020904 100%)',
    accent: '#22c55e',
    accent2: '#86efac',
    glow: 'rgba(34, 197, 94, 0.45)',
    badge: 'MATRIX',
    pattern: 'circuits',
    icon: 'controller',
  },
]

// Common compound prefixes in game titles
const COMPOUND_PREFIXES = [
  'cyber', 'star', 'war', 'battle', 'over', 'blood', 'bio', 'fall', 'dead', 'mine', 'witch', 'soul'
]

// Extract clean monogram (1 to 4 characters)
export function getGameMonogram(name) {
  if (!name) return '?'
  let clean = String(name)
    .replace(/[\[\(\{].*?[\]\)\}]/g, '') // remove brackets
    .replace(/[^\w\s-]/g, '')            // remove special symbols
    .trim()

  // Split camelCase (e.g. BioShock -> Bio Shock)
  clean = clean.replace(/([a-z0-9])([A-Z])/g, '$1 $2')

  const rawWords = clean.split(/[\s-]+/).filter(Boolean)
  const stopWords = new Set(['the', 'a', 'an', 'of', 'and', 'in', 'on', 'at', 'to', 'for'])

  // Expand compound single words if they start with a known prefix
  const words = []
  for (const w of rawWords) {
    const lower = w.toLowerCase()
    let matched = false
    for (const prefix of COMPOUND_PREFIXES) {
      if (lower.startsWith(prefix) && lower.length > prefix.length + 2) {
        words.push(w.slice(0, prefix.length))
        words.push(w.slice(prefix.length))
        matched = true
        break
      }
    }
    if (!matched) {
      words.push(w)
    }
  }

  // Filter out stop words unless that leaves no words
  const significant = words.filter(w => !stopWords.has(w.toLowerCase()))
  const activeWords = significant.length > 0 ? significant : words

  // Filter out standalone 4-digit years (e.g. 2077, 1999) if there are other words
  const nonYearWords = activeWords.filter(w => !/^\d{4}$/.test(w))
  const pool = nonYearWords.length > 0 ? nonYearWords : activeWords

  if (pool.length === 1) {
    const single = pool[0]
    // If it has digits at the end (e.g. Portal2 -> P2)
    const match = single.match(/^([a-zA-Z]+)(\d+)$/)
    if (match) {
      return (match[1][0] + match[2]).toUpperCase()
    }
    return single.slice(0, 3).toUpperCase()
  }

  // If last word is a small number (e.g. "2" in Half-Life 2), include it with initials
  const last = pool[pool.length - 1]
  const isSmallNum = /^\d{1,2}$/.test(last)
  const letters = pool
    .filter(w => !/^\d+$/.test(w))
    .slice(0, isSmallNum ? 2 : 3)
    .map(w => w[0])
    .join('')

  if (isSmallNum) {
    return (letters + last).toUpperCase()
  }

  return letters.toUpperCase() || pool[0].slice(0, 3).toUpperCase()
}

// Map game genres / keywords to suitable iconography & badges
export function detectGenreIcon(game) {
  if (game?.isVR) return { icon: 'vr', badge: 'VR EXPERIENCE' }

  const text = `${game?.name || ''} ${(game?.genres || []).join(' ')} ${game?.exeName || ''}`.toLowerCase()

  if (/vr|steamvr|openxr|oculus|vive/.test(text)) {
    return { icon: 'vr', badge: 'VIRTUAL REALITY' }
  }
  if (/racing|drift|kart|motorsport|forza|rally|drive|speed|f1|nascar/.test(text)) {
    return { icon: 'racing', badge: 'RACING' }
  }
  if (/fps|shooter|strike|sniper|combat|call of duty|battlefield|doom|quake|gun|warfare/.test(text)) {
    return { icon: 'crosshair', badge: 'SHOOTER' }
  }
  if (/rpg|role|souls|elder|elden|ring|witcher|fantasy|quest|blade|sword|dungeon|magic|dragon|scrolls/.test(text)) {
    return { icon: 'sword', badge: 'RPG' }
  }
  if (/horror|dead|zombie|evil|resident|silent|fear|fright|nightmare/.test(text)) {
    return { icon: 'skull', badge: 'HORROR' }
  }
  if (/space|galaxy|star|orbit|nebula|astro|interstellar|flight|eve/.test(text)) {
    return { icon: 'rocket', badge: 'SCI-FI' }
  }
  if (/strategy|civ|empire|tactics|chess|command|conquer|craft|crusader|crusade|tycoon/.test(text)) {
    return { icon: 'strategy', badge: 'STRATEGY' }
  }

  // Genre override from game.genres if present
  if (game?.genres?.[0]) {
    return { icon: 'controller', badge: String(game.genres[0]).toUpperCase() }
  }

  return null
}

export function getGameTheme(game) {
  const name = game?.name || 'Vapor Game'
  const hash = hashString(name + (game?.id || ''))
  const paletteIndex = hash % PALETTES.length
  const basePalette = PALETTES[paletteIndex]

  const genreMatch = detectGenreIcon(game)
  const icon = genreMatch?.icon || basePalette.icon
  const badge = genreMatch?.badge || (game?.genres?.[0] ? String(game.genres[0]).toUpperCase() : basePalette.badge)
  const monogram = getGameMonogram(name)

  return {
    ...basePalette,
    icon,
    badge,
    monogram,
    hash,
  }
}
