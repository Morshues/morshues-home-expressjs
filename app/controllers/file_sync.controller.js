const service = require('../services/file_sync.service')

exports.listFolder = async (req, res, next) => {
  try {
    const { userId, folderId } = req

    const entries = await service.list({ userId, folderId })
    res.json({ ok: true, entries })
  } catch (err) {
    next(err)
  }
}

exports.syncFolder = async (req, res, next) => {
  try {
    const { userId, folderId } = req
    const { entries = [] } = req.body || {}

    if (!Array.isArray(entries)) {
      return res.status(400).json({ ok: false, msg: 'entries must be an array' })
    }

    const diff = await service.diff({ userId, folderId, clientEntries: entries })
    res.json({ ok: true, ...diff })
  } catch (err) {
    next(err)
  }
}

exports.uploadFile = async (req, res, next) => {
  try {
    const { userId, folderId } = req

    if (!req.file) {
      return res.status(400).json({ ok: false, msg: 'file is required' })
    }

    const lastModified = Number(req.body.lastModified) / 1000
    const entry = await service.entryForFile({
      userId,
      folderId,
      fileName: req.file.filename,
      lastModified: lastModified,
    })
    res.status(201).json({ ok: true, entry })
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ ok: false, msg: 'file not found' })
    }
    next(err)
  }
}

exports.deleteFile = async (req, res, next) => {
  try {
    const { userId, folderId, fileName } = req

    await service.deleteFile({ userId, folderId, fileName })
    res.json({ ok: true })
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ ok: false, msg: 'file not found' })
    }
    next(err)
  }
}

exports.downloadFile = async (req, res, next) => {
  try {
    const { userId, folderId, fileName } = req

    const filePath = service.getFilePath({ userId, folderId, fileName })
    return res.download(filePath, fileName, (err) => {
      if (!err) return
      if (err.code === 'ENOENT' && !res.headersSent) {
        return res.status(404).json({ ok: false, msg: 'file not found' })
      }
      if (!res.headersSent) {
        return next(err)
      }
      next(err)
    })
  } catch (err) {
    next(err)
  }
}
