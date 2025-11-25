const fs = require('fs/promises')
const path = require('path')

const root = path.resolve(__dirname, '../../file_sync')
const HIDE_FILE_REGEX = /^\./

function buildDirectory(userId, folderId) {
  return path.join(root, userId.toString(), folderId)
}

function shouldIgnoreFileName(name) {
  return HIDE_FILE_REGEX.test(name)
}

function isAcceptedFileName(name) {
  return typeof name === 'string' && !shouldIgnoreFileName(name)
}

async function buildEntry(dir, name, lastModified = 0) {
  if (shouldIgnoreFileName(name)) return null
  const filePath = path.join(dir, name)
  const stats = await fs.stat(filePath)

  if (!stats.isFile()) return null

  if (lastModified !== 0) {
    await fs.utimes(filePath, lastModified, lastModified)
  }
  return {
    name,
    size: stats.size,
    mtimeMs: stats.mtimeMs,
  }
}

async function listServerFiles(userId, folderId) {
  const dir = buildDirectory(userId, folderId)
  let entries = []
  try {
    await fs.mkdir(dir, { recursive: true })
    const names = await fs.readdir(dir)
    entries = await Promise.all(
      names
        .filter((name) => !shouldIgnoreFileName(name))
        .map((name) => buildEntry(dir, name))
    )
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
  return entries.filter(Boolean)
}

exports.diff = async ({ userId, folderId, clientEntries }) => {
  const serverEntries = await listServerFiles(userId, folderId)
  const serverMap = new Map(serverEntries.map((f) => [f.name, f]))
  const filteredClientEntries = (clientEntries || []).filter(
    (f) => f?.name && isAcceptedFileName(f.name)
  )
  const clientMap = new Map(filteredClientEntries.map((f) => [f.name, f]))

  const upload = []
  const download = []
  const conflicts = []

  for (const [name, clientFile] of clientMap) {
    const serverFile = serverMap.get(name)
    if (!serverFile) {
      upload.push(clientFile)
      continue
    }
    if (serverFile.name !== clientFile.name) {
      if (serverFile.mtimeMs > clientFile.mtimeMs) download.push(serverFile)
      else if (serverFile.mtimeMs < clientFile.mtimeMs) upload.push(clientFile)
      else conflicts.push({ name, clientFile, serverFile })
    }
  }
  for (const [name, serverFile] of serverMap) {
    if (!clientMap.has(name)) download.push(serverFile)
  }
  return { upload, download, conflicts }
}

exports.list = async ({ userId, folderId }) => {
  return listServerFiles(userId, folderId)
}

exports.ensureFolder = async (userId, folderId) => {
  const dir = buildDirectory(userId, folderId)
  await fs.mkdir(dir, { recursive: true })
  return dir
}

exports.getFilePath = ({ userId, folderId, fileName }) => {
  return path.join(buildDirectory(userId, folderId), fileName)
}

exports.normalizeFileName = (name) => {
  if (typeof name !== 'string') return null
  const base = path.basename(name).trim()
  if (!base) return null
  const sanitized = base.replace(/[^A-Za-z0-9_.~-]/g, '_')
  if (!sanitized.length) return null
  if (shouldIgnoreFileName(sanitized)) return null
  return sanitized
}

exports.entryForFile = async ({ userId, folderId, fileName, lastModified }) => {
  const dir = buildDirectory(userId, folderId)
  const entry = await buildEntry(dir, fileName, lastModified)
  if (!entry) return null
  return entry
}
