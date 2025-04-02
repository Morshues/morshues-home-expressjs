const { TelegramClient } = require('telegram')
const { StringSession } = require('telegram/sessions')
const fs = require('fs')

const TG_API_ID = parseInt(process.env.TG_API_ID)
const TG_API_HASH = process.env.TG_API_HASH
const SESSION_PATH = 'cache/session.txt'
const sessionString = fs.existsSync(SESSION_PATH) ? fs.readFileSync(SESSION_PATH, 'utf8') : ''
const stringSession = new StringSession(sessionString)
const client = new TelegramClient(stringSession, TG_API_ID, TG_API_HASH, {
  connectionRetries: 5,
})
let codeResolver

async function initClient() {
  await client.connect()
}

async function startLogin(codeInputCallback, errorHandler) {
  await client.start({
    phoneNumber: process.env.TG_PHONE,
    password: process.env.TG_PASSWORD,
    phoneCode: async () =>
      new Promise((resolve) => {
        codeResolver = resolve
        if (codeInputCallback) codeInputCallback(resolve)
      }),
    onError: errorHandler || console.error,
  })

  saveSession()
  codeResolver = null
}

function submitCode(code) {
  if (!codeResolver) throw new Error('Code resolver not ready')
  codeResolver(code)
}

async function checkLogin() {
  try {
    await client.getMe()
    return true
  } catch (_) {
    return false
  }
}

function saveSession() {
  fs.writeFileSync(SESSION_PATH, client.session.save())
}

initClient()
  .then(/* Empty */)

module.exports = {
  client,
  startLogin,
  submitCode,
  checkLogin,
}
