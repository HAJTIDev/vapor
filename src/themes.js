/**
 * Theme registry for Vapor
 * Theme variables are defined in individual CSS files under src/themes/
 */

export const themes = {
  dark: { name: 'Dark (Default)' },
  light: { name: 'Light' },
  winxp: { name: 'eXP' },
  darkexp: { name: 'Dark eXP' },
  vista: { name: 'Aero' },
  darkaero: { name: 'Dark Aero' },
  cyberpunk: { name: 'Cyberpunk' },
  forest: { name: 'Forest' },
  nord: { name: 'Nord' },
  solarized: { name: 'Solarized Dark' },
  amoled: { name: 'AMOLED (Max Dark)' },
  winui3: { name: 'WinUI 3' },
}

import vaporApi from './vaporApi.js'

const CUSTOM_THEME_PREFIX = 'custom:'
const CUSTOM_THEME_STYLE_ID = 'vapor-custom-theme-style'
const DEFAULT_WINUI_MATERIAL = 'acrylic'

function isCustomThemeId(themeName) {
  return typeof themeName === 'string' && themeName.startsWith(CUSTOM_THEME_PREFIX)
}

export function getWinUi3Material() {
  if (typeof localStorage === 'undefined') return DEFAULT_WINUI_MATERIAL
  const stored = localStorage.getItem('vapor.winui3.material')
  return ['acrylic', 'mica', 'tabbed'].includes(stored) ? stored : DEFAULT_WINUI_MATERIAL
}

export function setWinUi3Material(material) {
  const valid = ['acrylic', 'mica', 'tabbed']
  const target = valid.includes(material) ? material : DEFAULT_WINUI_MATERIAL
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('vapor.winui3.material', target)
  }
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-winui-material', target)
  }
  if (getCurrentTheme() === 'winui3') {
    vaporApi.win?.setBackgroundMaterial?.(target)
  }
}

export function applyTheme(themeName) {
  const resolvedTheme = themes[themeName] || isCustomThemeId(themeName) ? themeName : 'dark'

  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', resolvedTheme)
    if (resolvedTheme === 'winui3') {
      document.documentElement.setAttribute('data-winui-material', getWinUi3Material())
    }
  }

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('vapor.theme', resolvedTheme)
  }

  // Synchronize Windows 11 backdrop material
  if (vaporApi.win?.setBackgroundMaterial) {
    if (resolvedTheme === 'winui3') {
      vaporApi.win.setBackgroundMaterial(getWinUi3Material())
    } else {
      vaporApi.win.setBackgroundMaterial('none')
    }
  }
}

export function getCurrentTheme() {
  if (typeof localStorage === 'undefined') return 'dark'
  const stored = localStorage.getItem('vapor.theme')
  return themes[stored] || isCustomThemeId(stored) ? stored : 'dark'
}

export function getThemeNames() {
  return Object.keys(themes)
}

export function applyCustomThemeCss(cssText) {
  if (typeof document === 'undefined') return

  const css = String(cssText || '').trim()
  const existing = document.getElementById(CUSTOM_THEME_STYLE_ID)

  if (!css) {
    if (existing) existing.remove()
    return
  }

  const styleEl = existing || document.createElement('style')
  styleEl.id = CUSTOM_THEME_STYLE_ID
  styleEl.textContent = css

  if (!existing) document.head.appendChild(styleEl)
}
