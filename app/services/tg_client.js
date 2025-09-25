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
    // Prevent timeout while checking login status by client.getMe
    await Promise.race([
      client.getMe(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
    ]);
    return true;
  } catch (err) {
    console.warn('[Telegram] getMe failed，reconnecting...', err.message);

    try {
      await client.connect();
      await Promise.race([
        client.getMe(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]);
      return true;
    } catch (reErr) {
      console.error('[Telegram] reconnect failed', reErr.message);
      return false;
    }
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
