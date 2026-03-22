/**
 * Theme system for Vapor
 * Each theme defines CSS variable overrides for the application
 */

const makeGradients = (c) => ({
  '--accent-gradient': `linear-gradient(135deg, ${c['--accent']} 0%, ${c['--accent2']} 100%)`,
  '--green-gradient': `linear-gradient(135deg, ${c['--green']} 0%, ${c['--green2']} 100%)`,
  '--red-gradient': `linear-gradient(135deg, ${c['--red']} 0%, ${c['--red2']} 100%)`,
})

export const themes = {
  dark: {
    name: 'Dark (Default)',
    colors: {
      '--bg': '#09090e',
      '--surface': '#111118',
      '--surface2': '#18181f',
      '--border': '#ffffff0d',
      '--border2': '#ffffff18',
      '--text': '#f0f0f5',
      '--text-dim': '#707088',
      '--text-muted': '#40404d',
      '--accent': '#6c63ff',
      '--accent2': '#8b5cf6',
      '--accent-dim': '#6c63ff22',
      '--green': '#4ade80',
      '--green2': '#22c55e',
      '--red': '#f87171',
      '--red2': '#ef4444',
    },
  },
  light: {
    name: 'Light',
    colors: {
      '--bg': '#ffffff',
      '--surface': '#f5f5f7',
      '--surface2': '#efefef',
      '--border': '#00000012',
      '--border2': '#00000024',
      '--text': '#0a0a0a',
      '--text-dim': '#4a4a5a',
      '--text-muted': '#8a8a9a',
      '--accent': '#7c3aed',
      '--accent2': '#6366f1',
      '--accent-dim': '#7c3aed22',
      '--green': '#22c55e',
      '--green2': '#16a34a',
      '--red': '#ef4444',
      '--red2': '#dc2626',
    },
  },
  cyberpunk: {
    name: 'Cyberpunk',
    colors: {
      '--bg': '#000508',
      '--surface': '#0a0e1a',
      '--surface2': '#1a1f35',
      '--border': '#00ffff15',
      '--border2': '#00ffff2a',
      '--text': '#00ffff',
      '--text-dim': '#00cc99',
      '--text-muted': '#0099ff',
      '--accent': '#ff00ff',
      '--accent2': '#ff44ff',
      '--accent-dim': '#ff00ff22',
      '--green': '#00ff00',
      '--green2': '#00ffaa',
      '--red': '#ff0055',
      '--red2': '#ff3366',
    },
  },
  forest: {
    name: 'Forest',
    colors: {
      '--bg': '#1a2e1a',
      '--surface': '#2d4a2d',
      '--surface2': '#3d5a3d',
      '--border': '#ffffff10',
      '--border2': '#ffffff18',
      '--text': '#e8f5e9',
      '--text-dim': '#a5d6a7',
      '--text-muted': '#81c784',
      '--accent': '#66bb6a',
      '--accent2': '#81c784',
      '--accent-dim': '#66bb6a22',
      '--green': '#4caf50',
      '--green2': '#2e7d32',
      '--red': '#e57373',
      '--red2': '#ef5350',
    },
  },
  nord: {
    name: 'Nord',
    colors: {
      '--bg': '#2e3440',
      '--surface': '#3b4252',
      '--surface2': '#434c5e',
      '--border': '#eceff4a0',
      '--border2': '#eceff418',
      '--text': '#eceff4',
      '--text-dim': '#d8dee9',
      '--text-muted': '#81a1c1',
      '--accent': '#81a1c1',
      '--accent2': '#88c0d0',
      '--accent-dim': '#81a1c122',
      '--green': '#a3be8c',
      '--green2': '#8fbcbb',
      '--red': '#bf616a',
      '--red2': '#d08770',
    },
  },
  solarized: {
    name: 'Solarized Dark',
    colors: {
      '--bg': '#002b36',
      '--surface': '#073642',
      '--surface2': '#586e75',
      '--border': '#839496',
      '--border2': '#93a1a1',
      '--text': '#93a1a1',
      '--text-dim': '#839496',
      '--text-muted': '#657b83',
      '--accent': '#268bd2',
      '--accent2': '#2aa198',
      '--accent-dim': '#268bd222',
      '--green': '#859900',
      '--green2': '#6c71c4',
      '--red': '#dc322f',
      '--red2': '#cb4b16',
    },
  },
  amoled: {
    name: 'AMOLED (Max Dark)',
    colors: {
      '--bg': '#000000',
      '--surface': '#0d0d0d',
      '--surface2': '#1a1a1a',
      '--border': '#ffffff08',
      '--border2': '#ffffff12',
      '--text': '#e0e0e0',
      '--text-dim': '#808080',
      '--text-muted': '#505050',
      '--accent': '#bb86fc',
      '--accent2': '#9d4edd',
      '--accent-dim': '#bb86fc22',
      '--green': '#69f0ae',
      '--green2': '#00bfa5',
      '--red': '#ff6b6b',
      '--red2': '#ff5252',
    },
  },
}

Object.values(themes).forEach(theme => {
  Object.assign(theme.colors, makeGradients(theme.colors))
})

export function applyTheme(themeName) {
  const theme = themes[themeName] || themes.dark
  const root = document.documentElement

  Object.entries(theme.colors).forEach(([key, value]) => {
    root.style.setProperty(key, value)
  })

  // Store preference
  localStorage.setItem('vapor.theme', themeName)
}

export function getCurrentTheme() {
  return localStorage.getItem('vapor.theme') || 'dark'
}

export function getThemeNames() {
  return Object.keys(themes)
}
