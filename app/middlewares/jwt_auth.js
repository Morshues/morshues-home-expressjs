const jwt = require('jsonwebtoken')

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET
function jwtAuth(req, res, next) {
  const auth = req.get('Authorization') || ''
  const m = auth.match(/^Bearer\s+(.+)$/i)
  if (!m) return res.status(401).json({ ok:false, msg:'missing bearer' })
  try {
    req.jwt = jwt.verify(m[1], JWT_ACCESS_SECRET)
    next()
  } catch (e) {
    return res.status(401).json({ ok:false, msg:'invalid token' })
  }
}
module.exports = { jwtAuth }
