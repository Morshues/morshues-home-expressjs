const db = require('../models')
const User = db.User
const WebhookMessage = db.WebhookMessage

const CHANNEL_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/

exports.receive = async (req, res) => {
  try {
    const { token, channel } = req.params
    if (!CHANNEL_PATTERN.test(channel)) {
      return res.status(400).json({ error: 'Invalid channel name' })
    }

    const user = await User.findOne({ where: { webhookToken: token } })
    if (!user) {
      return res.status(404).json({ error: 'Invalid webhook token' })
    }

    const body = req.body == null ? {} : req.body
    const payload = typeof body === 'object' && !Array.isArray(body) ? body : { value: body }

    await WebhookMessage.create({
      userId: user.id,
      channel,
      sourceIp: req.ip,
      headers: req.headers,
      body: payload,
    })

    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('Webhook receive error:', err)
    res.status(500).json({ error: 'Internal error' })
  }
}

exports.showList = async (req, res) => {
  const { channel } = req.query
  const where = { userId: req.user.id }
  if (channel && CHANNEL_PATTERN.test(channel)) {
    where.channel = channel
  }

  const messages = await WebhookMessage.findAll({
    where,
    order: [['receivedAt', 'DESC']],
    limit: 50,
  })

  const items = messages.map(m => {
    const plain = m.get({ plain: true })
    return {
      id: plain.id,
      channel: plain.channel,
      sourceIp: plain.sourceIp,
      receivedAt: plain.receivedAt,
      headers: JSON.stringify(plain.headers, null, 2),
      body: JSON.stringify(plain.body, null, 2),
    }
  })

  res.render('webhook/list', {
    title: 'Webhook Messages',
    showUserStatus: true,
    messages: items,
    filterChannel: where.channel || '',
  })
}
