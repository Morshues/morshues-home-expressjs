const SAFE_SEGMENT_REGEX = /^[A-Za-z0-9_.-]+$/

exports.validateFolderId = (req, res, next, value) => {
  if (!SAFE_SEGMENT_REGEX.test(value)) {
    return res.status(400).json({ ok: false, msg: 'invalid folder' })
  }
  req.folderId = value
  next()
}

exports.validateFileName = (req, res, next, value) => {
  if (!SAFE_SEGMENT_REGEX.test(value)) {
    return res.status(400).json({ ok: false, msg: 'invalid file reference' })
  }
  req.fileName = value
  next()
}
