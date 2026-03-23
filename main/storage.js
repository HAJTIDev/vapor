const fs = require('fs')
const path = require('path')

function loadJSON(file, def) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {}
  return def
}

function saveJSON(file, data) {
  const dir = path.dirname(file)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = `${file}.tmp`
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2))
    fs.renameSync(tmp, file)
  } catch (err) {
    console.error('[saveJSON] Failed to save', file, err)
    try {
      fs.unlinkSync(tmp)
    } catch {}
    throw err
  }
}

module.exports = {
  loadJSON,
  saveJSON,
}
