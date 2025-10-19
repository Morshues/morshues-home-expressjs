const fs = require('fs/promises')
const fsNative = require('fs')
const path = require('path')
const crypto = require('crypto')

const root = path.resolve(__dirname, '../../file_sync')

async function checksum(filePath) {
  const hash = crypto.createHash('md5')
  const stream = fsNative.createReadStream(filePath)
  return new Promise((resolve, reject) => {
    stream.on('data', (d) => hash.update(d))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

function buildDirectory(userId, folderId) {
  return path.join(root, userId.toString(), folderId)
}

async function buildEntry(dir, name, lastModified = 0) {
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
    checksum: await checksum(filePath),
  }
}

async function listServerFiles(userId, folderId) {
  const dir = buildDirectory(userId, folderId)
  let entries = []
  try {
    await fs.mkdir(dir, { recursive: true })
    const names = await fs.readdir(dir)
    entries = await Promise.all(names.map(name => buildEntry(dir, name)))
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
  return entries.filter(Boolean)
}

exports.diff = async ({ userId, folderId, clientEntries }) => {
  const serverEntries = await listServerFiles(userId, folderId)
  const serverMap = new Map(serverEntries.map(f => [f.name, f]))
  const clientMap = new Map(clientEntries.map(f => [f.name, f]))

  const upload = []
  const download = []
  const conflicts = []

  for (const [name, clientFile] of clientMap) {
    const serverFile = serverMap.get(name)
    if (!serverFile) {
      upload.push(clientFile)
      continue
    }
    if (serverFile.checksum !== clientFile.checksum) {
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
  const sanitized = base.replace(/[^A-Za-z0-9_.-]/g, '_')
  return sanitized.length ? sanitized : null
}

exports.entryForFile = async ({ userId, folderId, fileName, lastModified }) => {
  const dir = buildDirectory(userId, folderId)
  const entry = await buildEntry(dir, fileName, lastModified)
  if (!entry) return null
  return entry
}
