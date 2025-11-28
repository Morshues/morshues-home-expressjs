const jwt = require('jsonwebtoken')

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET

exports.jwtAuth = (req, res, next) => {
  const auth = req.get('Authorization') || ''
  const m = auth.match(/^Bearer\s+(.+)$/i)
  if (!m) return res.status(401).json({ ok: false, msg: 'missing bearer' })
  try {
    req.jwt = jwt.verify(m[1], JWT_ACCESS_SECRET)
    req.userId = Number(req.jwt.sub)
    req.user = { id: req.userId }
    if (req.userId === 0) {
      return res.status(401).json({ ok: false, msg: 'unauthorized' })
    }
    next()
  } catch (e) {
    return res.status(401).json({ ok: false, msg: 'invalid token' })
  }
}
