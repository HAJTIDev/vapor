import { describe, it, expect, beforeEach, vi } from 'vitest'

const store = new Map()
const attributes = new Map()

globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
}

globalThis.document = {
  documentElement: {
    setAttribute: (k, v) => attributes.set(k, String(v)),
    getAttribute: (k) => (attributes.has(k) ? attributes.get(k) : null),
    removeAttribute: (k) => attributes.delete(k),
  },
}

globalThis.window = {
  localStorage: globalThis.localStorage,
}

import { themes, applyTheme, getCurrentTheme, getWinUi3Material, setWinUi3Material } from '../src/themes.js'
import vaporApi from '../src/vaporApi.js'

describe('Theme System & WinUI 3', () => {
  beforeEach(() => {
    store.clear()
    attributes.clear()
    if (vaporApi.win) {
      vaporApi.win.setBackgroundMaterial = vi.fn()
    }
  })

  it('includes winui3 in theme registry', () => {
    expect(themes.winui3).toBeDefined()
    expect(themes.winui3.name).toBe('WinUI 3')
  })

  it('applies winui3 theme and sets data-theme and data-winui-material', () => {
    applyTheme('winui3')
    expect(document.documentElement.getAttribute('data-theme')).toBe('winui3')
    expect(document.documentElement.getAttribute('data-winui-material')).toBe('acrylic')
    expect(getCurrentTheme()).toBe('winui3')
  })

  it('changes WinUI 3 backdrop material to mica and tabbed', () => {
    applyTheme('winui3')
    setWinUi3Material('mica')
    expect(getWinUi3Material()).toBe('mica')
    expect(document.documentElement.getAttribute('data-winui-material')).toBe('mica')

    setWinUi3Material('tabbed')
    expect(getWinUi3Material()).toBe('tabbed')
    expect(document.documentElement.getAttribute('data-winui-material')).toBe('tabbed')
  })

  it('synchronizes backgroundMaterial with vaporApi when switching themes', () => {
    applyTheme('winui3')
    expect(vaporApi.win.setBackgroundMaterial).toHaveBeenCalledWith('acrylic')

    applyTheme('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(vaporApi.win.setBackgroundMaterial).toHaveBeenCalledWith('none')
  })
})
