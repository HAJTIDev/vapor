/**
 * Theme registry for Vapor
 * Theme variables are defined in individual CSS files under src/themes/
 */

export const themes = {
  dark: { name: 'Dark (Default)' },
  light: { name: 'Light' },
  winxp: { name: 'eXP' },
  vista: { name: 'Aero' },
  cyberpunk: { name: 'Cyberpunk' },
  forest: { name: 'Forest' },
  nord: { name: 'Nord' },
  solarized: { name: 'Solarized Dark' },
  amoled: { name: 'AMOLED (Max Dark)' },
}

export function applyTheme(themeName) {
  const resolvedTheme = themes[themeName] ? themeName : 'dark'

  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', resolvedTheme)
  }

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('vapor.theme', resolvedTheme)
  }
}

export function getCurrentTheme() {
  if (typeof localStorage === 'undefined') return 'dark'
  const stored = localStorage.getItem('vapor.theme')
  return themes[stored] ? stored : 'dark'
}

export function getThemeNames() {
  return Object.keys(themes)
}
