const BASE_URL = 'https://howlongtobeat.com/'
const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

let cachedSearchPath = null
let cachedAuthData = null
let cachedAt = 0
const CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes

function formatHours(seconds) {
  if (!seconds || seconds <= 0 || !Number.isFinite(seconds)) return null
  const hours = seconds / 3600
  if (hours < 1) {
    const mins = Math.round(seconds / 60)
    return `${mins}m`
  }
  if (hours >= 100) {
    return `${Math.round(hours)}h`
  }
  const rounded = Math.round(hours * 2) / 2
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}h`
}

function cleanTitle(raw) {
  if (!raw) return ''
  return String(raw)
    .replace(/\[[^\]]*\]/g, '') // remove [brackets]
    .replace(/\([^\)]*\)/g, '') // remove (parentheses)
    .replace(/\bv\d+(\.\d+)*\b/gi, '') // remove versions like v1.4.0
    .replace(/[._-]+/g, ' ')
    .replace(/\b(build \d+|edition|remastered|deluxe|goty|repack|gog|steam|fitgirl|rip|bundle)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function discoverSearchPathAndToken(forceRefresh = false) {
  const now = Date.now()
  if (!forceRefresh && cachedSearchPath && cachedAuthData && (now - cachedAt < CACHE_TTL_MS)) {
    return { searchPath: cachedSearchPath, authData: cachedAuthData }
  }

  const homeRes = await fetch(BASE_URL, {
    headers: {
      'User-Agent': DEFAULT_UA,
      'Referer': BASE_URL,
    },
  })
  if (!homeRes.ok) {
    throw new Error(`Failed to load HLTB homepage: status ${homeRes.status}`)
  }

  const html = await homeRes.text()
  const scriptMatches = [...html.matchAll(/src=["'](\/_next\/static\/chunks\/[^"']+\.js)["']/g)].map(m => m[1])

  let foundPath = '/api/search/site' // default fallback
  for (const s of scriptMatches) {
    try {
      const sUrl = BASE_URL + s.replace(/^\//, '')
      const sRes = await fetch(sUrl, {
        headers: { 'User-Agent': DEFAULT_UA, 'Referer': BASE_URL },
      })
      if (!sRes.ok) continue
      const text = await sRes.text()
      const m = text.match(/fetch\s*\(\s*["']\/api\/([a-zA-Z0-9_/]+)[^"']*["']\s*,\s*\{[^}]*method:\s*["']POST["']/i)
      if (m && m[1]) {
        foundPath = '/api/' + m[1].replace(/\/+$/, '')
        break
      }
    } catch {
      // Continue to next script
    }
  }

  const initUrl = BASE_URL + foundPath.replace(/^\//, '') + '/init?t=' + Date.now()
  const initRes = await fetch(initUrl, {
    headers: { 'User-Agent': DEFAULT_UA, 'Referer': BASE_URL },
  })
  if (!initRes.ok) {
    throw new Error(`Failed to initialize HLTB session: status ${initRes.status}`)
  }

  const authData = await initRes.json()
  cachedSearchPath = foundPath
  cachedAuthData = authData
  cachedAt = Date.now()

  return { searchPath: foundPath, authData }
}

async function searchHltb(gameName, retry = true) {
  const clean = cleanTitle(gameName)
  if (!clean) return { ok: false, error: 'Empty game title', results: [] }

  try {
    const { searchPath, authData } = await discoverSearchPathAndToken()

    const payload = {
      searchType: 'games',
      searchTerms: clean.split(' ').filter(Boolean),
      searchPage: 1,
      size: 6,
      searchOptions: {
        games: {
          userId: 0,
          platform: '',
          sortCategory: 'popular',
          rangeCategory: 'main',
          rangeTime: { min: 0, max: 0 },
          gameplay: { perspective: '', flow: '', genre: '' },
          modifier: '',
        },
        users: { sortCategory: 'postcount' },
        filter: '',
        sort: 0,
        randomizer: 0,
      },
    }

    const headers = {
      'content-type': 'application/json',
      'User-Agent': DEFAULT_UA,
      'Referer': BASE_URL,
      'Origin': BASE_URL,
    }

    if (authData?.token) headers['x-auth-token'] = authData.token
    for (const [k, v] of Object.entries(authData || {})) {
      if (/key/i.test(k)) headers['x-hp-key'] = v
      if (/val/i.test(k)) headers['x-hp-val'] = v
    }

    const postUrl = BASE_URL + searchPath.replace(/^\//, '')
    const searchRes = await fetch(postUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })

    if (!searchRes.ok) {
      if (retry && (searchRes.status === 401 || searchRes.status === 403)) {
        cachedSearchPath = null
        cachedAuthData = null
        cachedAt = 0
        await discoverSearchPathAndToken(true)
        return searchHltb(gameName, false)
      }
      throw new Error(`HLTB search returned status ${searchRes.status}`)
    }

    const json = await searchRes.json()
    const rawList = Array.isArray(json?.data) ? json.data : []

    const results = rawList.map((item) => ({
      id: item.game_id,
      name: item.game_name,
      image: item.game_image ? `https://howlongtobeat.com/games/${item.game_image}` : null,
      main: formatHours(item.comp_main),
      mainSec: item.comp_main || 0,
      extra: formatHours(item.comp_plus),
      extraSec: item.comp_plus || 0,
      completionist: formatHours(item.comp_100),
      completionistSec: item.comp_100 || 0,
      url: `https://howlongtobeat.com/game/${item.game_id}`,
      releaseYear: item.release_world || null,
      platforms: item.profile_platform || '',
    }))

    return {
      ok: true,
      query: clean,
      results,
      bestMatch: results[0] || null,
    }
  } catch (err) {
    if (retry) {
      cachedSearchPath = null
      cachedAuthData = null
      cachedAt = 0
      return searchHltb(gameName, false)
    }
    return {
      ok: false,
      error: err.message,
      results: [],
      bestMatch: null,
    }
  }
}

module.exports = {
  searchHltb,
  cleanTitle,
  formatHours,
}
