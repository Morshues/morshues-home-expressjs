const { TelegramClient, Api } = require('telegram')
const { StringSession } = require('telegram/sessions')
const db = require('../models')

const TelegramSession = db.TelegramSession

const TG_API_ID = Number.parseInt(process.env.TG_API_ID, 10)
const TG_API_HASH = process.env.TG_API_HASH

if (!TG_API_ID || !TG_API_HASH) {
  throw new Error('TG_API_ID and TG_API_HASH must be configured')
}

const API_CREDENTIALS = {
  apiId: TG_API_ID,
  apiHash: TG_API_HASH,
}

const clients = new Map()
const pendingLogins = new Map()

async function createClient(session = '') {
  const stringSession = new StringSession(session || '')
  const client = new TelegramClient(stringSession, TG_API_ID, TG_API_HASH, {
    connectionRetries: 5,
  })
  await client.connect()
  return client
}

async function getClient(userId) {
  if (clients.has(userId)) {
    return clients.get(userId)
  }

  const record = await TelegramSession.findOne({ where: { user_id: userId } })
  if (!record) {
    return null
  }

  const client = await createClient(record.sessionData)
  clients.set(userId, client)
  return client
}

async function startLogin(userId, phoneNumber, password = '') {
  if (!phoneNumber) {
    throw new Error('Phone number is required')
  }

  const pending = pendingLogins.get(userId)
  if (pending) {
    pendingLogins.delete(userId)
    await pending.client.disconnect().catch(() => {/* ignore */})
  }

  const existingClient = clients.get(userId)
  if (existingClient) {
    await existingClient.disconnect().catch(() => {/* ignore */})
    clients.delete(userId)
  }

  const client = await createClient('')

  try {
    const { phoneCodeHash } = await client.sendCode(API_CREDENTIALS, phoneNumber)
    pendingLogins.set(userId, {
      client,
      phoneNumber,
      phoneCodeHash,
      password: password || '',
    })
  } catch (err) {
    await client.disconnect().catch(() => {/* ignore */})
    throw err
  }
}

async function upsertSession(userId, phoneNumber, sessionData) {
  const [record, created] = await TelegramSession.findOrCreate({
    where: { user_id: userId },
    defaults: {
      userId,
      phoneNumber,
      sessionData,
    },
  })

  if (!created) {
    record.phoneNumber = phoneNumber
    record.sessionData = sessionData
    await record.save()
  }

  return record
}

async function submitCode(userId, code) {
  const pending = pendingLogins.get(userId)
  if (!pending) {
    throw new Error('No pending Telegram login. Please request a new code first.')
  }

  const { client, phoneNumber, phoneCodeHash, password } = pending
  try {
    const result = await client.invoke(new Api.auth.SignIn({
      phoneNumber,
      phoneCodeHash,
      phoneCode: code,
    }))

    if (result instanceof Api.auth.AuthorizationSignUpRequired) {
      throw new Error('Please finish creating this Telegram account via the official app before continuing.')
    }
  } catch (err) {
    if (err.errorMessage === 'SESSION_PASSWORD_NEEDED') {
      if (!password) {
        await client.disconnect().catch(() => {/* ignore */})
        pendingLogins.delete(userId)
        throw new Error('Two-factor password required. Restart login and provide the password.')
      }

      try {
        await client.signInWithPassword(API_CREDENTIALS, {
          password: async () => password,
          onError: () => false,
        })
      } catch (pwdErr) {
        await client.disconnect().catch(() => {/* ignore */})
        pendingLogins.delete(userId)
        throw pwdErr
      }
    } else {
      throw err
    }
  }

  const sessionString = client.session.save()
  await upsertSession(userId, phoneNumber, sessionString)

  pendingLogins.delete(userId)
  clients.set(userId, client)

  return true
}

async function checkLogin(userId) {
  const client = await getClient(userId)
  if (!client) {
    return false
  }

  try {
    await Promise.race([
      client.getMe(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
    ])
    return true
  } catch (err) {
    console.warn('[Telegram] getMe failed, reconnecting...', err.message)
    try {
      await client.connect()
      await Promise.race([
        client.getMe(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ])
      return true
    } catch (reErr) {
      console.error('[Telegram] reconnect failed', reErr.message)
      clients.delete(userId)
      return false
    }
  }
}

module.exports = {
  startLogin,
  submitCode,
  checkLogin,
  getClient,
}
