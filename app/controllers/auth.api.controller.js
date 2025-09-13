const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const db = require('../models')
const { Admin } = require("../models")
const { User, RefreshToken } = db

const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_TTL || '15m'
const REFRESH_EXPIRES_DAYS = Number(process.env.JWT_REFRESH_TTL_DAYS || 30)
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET
const JWT_ISSUER = process.env.JWT_ISSUER || 'morshues_home'

function sha256Hex(s) {
  return crypto.createHash('sha256').update(s).digest('hex')
}

function randToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex')
}

async function signAccess(user) {
  const adminRow = await Admin.findOne({ where: { user_id: user.id } })
  const isAdmin = !!adminRow
  return jwt.sign(
    { sub: String(user.id), email: user.email, isAdmin },
    JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRES_IN, issuer: JWT_ISSUER }
  )
}

function refreshExpiryDate() {
  const d = new Date()
  d.setDate(d.getDate() + REFRESH_EXPIRES_DAYS)
  return d
}

exports.loginJson = async (req, res) => {
  // JSON: { email, password, deviceId }
  const { email, password, deviceId } = req.body || {}
  if (!email || !password || !deviceId)
    return res.status(400).json({ ok: false, msg: 'email/password/deviceId required' })

  const user = await User.findOne({ where: { email } })
  if (!user) return res.status(401).json({ ok: false, msg: 'invalid credentials' })

  const match = await bcrypt.compare(password, user.password)
  if (!match) return res.status(401).json({ ok: false, msg: 'invalid credentials' })

  user.lastLogin = new Date()
  await user.save()

  const accessToken = await signAccess(user)
  const refreshRaw = randToken(48)
  const tokenHash = sha256Hex(refreshRaw)
  const expiresAt = refreshExpiryDate()

  const row = await RefreshToken.findOne({
    where: { user_id: user.id, device_id: deviceId }
  })
  if (row) {
    row.tokenHash = tokenHash
    row.expiresAt = expiresAt
    row.revokedAt = null
    row.userAgent = req.get('user-agent') || null
    row.ip = req.ip || null
    await row.save()
  } else {
    await RefreshToken.create({
      user_id: user.id,
      tokenHash,
      deviceId,
      userAgent: req.get('user-agent') || null,
      ip: req.ip || null,
      expiresAt: expiresAt
    })
  }

  res.json({
    ok: true,
    accessToken,
    refreshToken: refreshRaw,
    user: { id: user.id, email: user.email, name: user.name }
  })
}

exports.refresh = async (req, res) => {
  // JSON: { refreshToken, deviceId }
  const { refreshToken, deviceId } = req.body || {}
  if (!refreshToken || !deviceId) return res.status(400).json({ ok: false, msg: 'missing' })

  const hash = sha256Hex(refreshToken)
  const row = await RefreshToken.findOne({ where: { tokenHash: hash, device_id: deviceId } })
  if (!row || row.revokedAt) return res.status(401).json({ ok: false, msg: 'invalid refresh' })
  if (row.expiresAt < new Date()) return res.status(401).json({ ok: false, msg: 'expired refresh' })

  const user = await User.findByPk(row.user_id)
  if (!user) return res.status(401).json({ ok: false, msg: 'user not found' })

  const newRefreshRaw = randToken(48)
  row.tokenHash = sha256Hex(newRefreshRaw)
  row.expiresAt = refreshExpiryDate()
  await row.save()

  res.json({ ok: true, accessToken: await signAccess(user), refreshToken: newRefreshRaw })
}

exports.logoutJson = async (req, res) => {
  // JSON: { refreshToken, deviceId }
  const { refreshToken, deviceId } = req.body || {}
  if (!refreshToken || !deviceId) return res.status(400).json({ ok: false, msg: 'missing refreshToken/deviceId' })
  const hash = sha256Hex(refreshToken)
  const row = await RefreshToken.findOne({ where: { tokenHash: hash, device_id: deviceId } })
  if (row) await row.destroy()
  res.json({ ok: true })
}

exports.listMyDevices = async (req, res) => {
  const userId = Number(req.jwt.sub)
  const rows = await RefreshToken.findAll({
    where: { user_id: userId },
    order: [['created_at','DESC']],
    attributes: ['deviceId','userAgent','ip','expiresAt','revokedAt','created_at']
  })
  res.json({ ok:true, items: rows })
}
