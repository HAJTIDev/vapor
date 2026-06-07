const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

function splitArgs(value) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

function buildFreearcArgs(archivePath, outputDir, overwrite, extraArgs = []) {
  const args = ['x']
  if (overwrite) {
    args.push('-y')
  }
  args.push(`-o${outputDir}`)
  args.push(archivePath)
  args.push(...extraArgs)
  return args
}

function resolveArchivePath(candidatePath) {
  const archivePath = path.resolve(String(candidatePath || ''))
  if (!archivePath) {
    throw new Error('Archive path is required.')
  }
  if (!fs.existsSync(archivePath)) {
    throw new Error(`Archive not found: ${archivePath}`)
  }
  if (!fs.statSync(archivePath).isFile()) {
    throw new Error(`Archive path is not a file: ${archivePath}`)
  }
  return archivePath
}

function resolveOutputDir(archivePath, requestedOutputDir) {
  if (requestedOutputDir) {
    return path.resolve(requestedOutputDir)
  }
  const archiveBase = path.basename(archivePath).replace(/\.[^.]+$/, '')
  return path.join(path.dirname(archivePath), archiveBase)
}

function findArchiveFile(files, extensions = ['.bin']) {
  if (!Array.isArray(files)) return null
  const lowerExtensions = extensions.map((extension) => String(extension || '').toLowerCase())
  return files.find((file) => {
    const filePath = String(file?.path || '')
    const lowerPath = filePath.toLowerCase()
    return lowerExtensions.some((extension) => lowerPath.endsWith(extension))
  }) || null
}

function extractArchiveWithFreearc({ archivePath, outputDir, freearcBin, extraArgs = [], overwrite = false }) {
  return new Promise((resolve) => {
    const resolvedArchivePath = resolveArchivePath(archivePath)
    const resolvedOutputDir = resolveOutputDir(resolvedArchivePath, outputDir)
    const command = String(freearcBin || process.env.FREARC_BIN || process.env.FREARC_COMMAND || 'freearc').trim() || 'freearc'
    const args = buildFreearcArgs(resolvedArchivePath, resolvedOutputDir, overwrite, extraArgs)

    fs.mkdirSync(resolvedOutputDir, { recursive: true })

    const child = spawn(command, args, {
      stdio: 'inherit',
      windowsHide: true,
    })

    child.on('error', (error) => {
      resolve({ ok: false, error: error?.message || 'Failed to start Freearc.' })
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ ok: true, archivePath: resolvedArchivePath, outputDir: resolvedOutputDir })
        return
      }
      resolve({ ok: false, error: `Freearc exited with code ${code}` })
    })
  })
}

module.exports = {
  buildFreearcArgs,
  extractArchiveWithFreearc,
  findArchiveFile,
  resolveArchivePath,
  resolveOutputDir,
  splitArgs,
}