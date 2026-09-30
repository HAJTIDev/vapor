const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 VaporLauncher/1.6'

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

const INTERESTING_SECTION_KEYWORDS = [
  'essential improvements',
  'field of view',
  'fov',
  'video',
  'issues fixed',
  'issues unresolved',
  'save game data location',
  'configuration file(s) location',
  'launch options',
  'skip intro',
  'frame rate',
  'ultrawide',
  'controller support',
  'game data'
]

async function searchPcgw(gameName) {
  const clean = cleanTitle(gameName)
  if (!clean) {
    return { ok: false, error: 'Empty game title', found: false }
  }

  const searchUrl = `https://www.pcgamingwiki.com/w/api.php?action=opensearch&format=json&limit=6&search=${encodeURIComponent(clean)}`

  try {
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': DEFAULT_UA,
        'Accept': 'application/json',
      },
    })

    if (!res.ok) {
      throw new Error(`PCGamingWiki search failed with status ${res.status}`)
    }

    const data = await res.json()
    // data structure: [query, titles[], descriptions[], urls[]]
    const titles = Array.isArray(data?.[1]) ? data[1] : []
    const urls = Array.isArray(data?.[3]) ? data[3] : []

    if (!titles.length) {
      return {
        ok: true,
        found: false,
        query: clean,
        searchUrl: `https://www.pcgamingwiki.com/w/index.php?search=${encodeURIComponent(clean)}`,
      }
    }

    const primaryTitle = titles[0]
    const primaryUrl = urls[0] || `https://www.pcgamingwiki.com/wiki/${encodeURIComponent(primaryTitle)}`

    // Fetch table of contents / sections for the primary page
    let keySections = []
    try {
      const parseUrl = `https://www.pcgamingwiki.com/w/api.php?action=parse&page=${encodeURIComponent(primaryTitle)}&prop=sections&format=json`
      const parseRes = await fetch(parseUrl, {
        headers: {
          'User-Agent': DEFAULT_UA,
          'Accept': 'application/json',
        },
      })

      if (parseRes.ok) {
        const parseData = await parseRes.json()
        const rawSections = Array.isArray(parseData?.parse?.sections) ? parseData.parse.sections : []

        keySections = rawSections
          .filter(s => {
            const line = String(s.line || '').toLowerCase()
            return INTERESTING_SECTION_KEYWORDS.some(keyword => line.includes(keyword))
          })
          .map(s => ({
            line: s.line,
            level: Number(s.level) || 2,
            anchor: s.anchor,
            url: `${primaryUrl}#${s.anchor}`,
          }))
      }
    } catch (parseErr) {
      console.warn('[pcgw] Could not parse page sections:', parseErr.message)
    }

    const matches = titles.map((title, idx) => ({
      title,
      url: urls[idx] || `https://www.pcgamingwiki.com/wiki/${encodeURIComponent(title)}`,
    }))

    return {
      ok: true,
      found: true,
      query: clean,
      title: primaryTitle,
      url: primaryUrl,
      sections: keySections,
      matches,
    }
  } catch (err) {
    console.error('[pcgw] Error querying PCGamingWiki:', err)
    return {
      ok: false,
      found: false,
      error: err.message || 'Failed to reach PCGamingWiki',
      searchUrl: `https://www.pcgamingwiki.com/w/index.php?search=${encodeURIComponent(clean)}`,
    }
  }
}

module.exports = {
  cleanTitle,
  searchPcgw,
}
