const fs = require('fs')
const crypto = require('crypto')
const { net } = require('electron')

const SGDB_BASE = 'https://www.steamgriddb.com/api/v2'

function createSgdbService({ ENCRYPTION_KEY, encryptedKeyFile, sgdbKeyFile, allowRuntimeKeyOverride = true }) {
  let sgdbKeyCache = null

  function normalizeSgdbKey(raw) {
    const trimmed = String(raw || '').trim()
    if (!trimmed) return ''
    return trimmed.replace(/^Bearer\s+/i, '').trim()
  }

  function decryptApiKey(encrypted) {
    try {
      const { iv, data } = JSON.parse(encrypted)
      const keyHash = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest()
      const decipher = crypto.createDecipheriv('aes-256-cbc', keyHash, Buffer.from(iv, 'hex'))
      let decrypted = decipher.update(data, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      return decrypted
    } catch {
      return null
    }
  }

  function resetSgdbModule() {}

  function loadSgdbKey() {
    if (sgdbKeyCache !== null) return sgdbKeyCache

    try {
      if (allowRuntimeKeyOverride && fs.existsSync(sgdbKeyFile)) {
        sgdbKeyCache = normalizeSgdbKey(fs.readFileSync(sgdbKeyFile, 'utf8'))
      } else if (fs.existsSync(encryptedKeyFile)) {
        const encrypted = fs.readFileSync(encryptedKeyFile, 'utf8')
        sgdbKeyCache = normalizeSgdbKey(decryptApiKey(encrypted)) || ''
      } else {
        const envKey = normalizeSgdbKey(process.env.SGDB_API_KEY || process.env.SGDB_KEY)
        sgdbKeyCache = envKey || ''
      }
    } catch {
      const envKey = normalizeSgdbKey(process.env.SGDB_API_KEY || process.env.SGDB_KEY)
      sgdbKeyCache = envKey || ''
    }
    return sgdbKeyCache
  }

  function saveSgdbKey(key) {
    if (!allowRuntimeKeyOverride) {
      return false
    }
    try {
      const normalizedKey = normalizeSgdbKey(key)
      if (!normalizedKey) {
        if (fs.existsSync(sgdbKeyFile)) fs.unlinkSync(sgdbKeyFile)
        sgdbKeyCache = ''
        resetSgdbModule()
        console.log('[saveSgdbKey] Key cleared')
        return true
      }
      sgdbKeyCache = normalizedKey
      fs.writeFileSync(sgdbKeyFile, normalizedKey)
      resetSgdbModule()
      console.log('[saveSgdbKey] Key saved, length:', normalizedKey.length)
      return true
    } catch (err) {
      console.error('[saveSgdbKey] Error:', err)
      return false
    }
  }

  function netFetch(url, headers = {}) {
    return new Promise((resolve, reject) => {
      const req = net.request({ url, method: 'GET' })
      Object.entries(headers).forEach(([k, v]) => req.setHeader(k, v))
      let body = ''
      req.on('response', (res) => {
        res.on('data', (c) => {
          body += c
        })
        res.on('end', () => resolve({ status: res.statusCode, body }))
      })
      req.on('error', reject)
      req.end()
    })
  }

  async function sgdbFetch(endpoint) {
    const key = loadSgdbKey()
    if (!key) {
      console.error('[sgdbFetch] No API key loaded')
      return null
    }

    try {
      const url = `${SGDB_BASE}${endpoint}`
      const { status, body } = await netFetch(url, {
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
      })
      if (status >= 400) {
        console.error('[sgdbFetch] HTTP Error:', status, body?.substring?.(0, 200))
        return null
      }
      if (!body || !body.trim().startsWith('{')) {
        console.error('[sgdbFetch] Non-JSON response:', body?.substring?.(0, 300))
        return null
      }
      return JSON.parse(body)
    } catch (err) {
      console.error('[sgdbFetch] Error:', err.message || err)
      return null
    }
  }

  async function sgdbSearch(name) {
    const key = loadSgdbKey()
    if (!key) {
      console.log('[sgdbSearch] No API key')
      return null
    }

    try {
      console.log('[sgdbSearch] Searching for:', name)
      const data = await sgdbFetch(`/search/autocomplete/${encodeURIComponent(name)}`)
      if (!data?.data?.length) return null
      const game = data.data[0]
      console.log('[sgdbSearch] Found:', game.name, 'ID:', game.id)
      return { id: game.id, name: game.name }
    } catch (err) {
      console.error('[sgdbSearch] Error:', err)
      return null
    }
  }

  async function sgdbArt(gameId) {
    try {
      console.log('[sgdbArt] Fetching art for game ID:', gameId)
      const [grids, heroes, logos] = await Promise.all([
        sgdbFetch(`/grids/game/${gameId}?dimensions=600x900`),
        sgdbFetch(`/heroes/game/${gameId}`),
        sgdbFetch(`/logos/game/${gameId}`),
      ])
      console.log('[sgdbArt] Got:', {
        grid: !!grids?.data?.[0],
        hero: !!heroes?.data?.[0],
        logo: !!logos?.data?.[0],
      })
      return {
        grid: grids?.data?.[0]?.url || null,
        hero: heroes?.data?.[0]?.url || null,
        logo: logos?.data?.[0]?.url || null,
      }
    } catch (err) {
      console.error('[sgdbArt] Error:', err)
      return { grid: null, hero: null, logo: null }
    }
  }

  return {
    loadSgdbKey,
    saveSgdbKey,
    sgdbSearch,
    sgdbArt,
  }
}

module.exports = {
  createSgdbService,
}
