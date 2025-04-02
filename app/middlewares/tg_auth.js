const { checkLogin } = require('../services/tg_client')

const requireTelegramLogin = async (req, res, next) => {
  const isLoggedIn = await checkLogin()
  if (!isLoggedIn) {
    return res.redirect('/tg/login')
  }
  next()
}

const loggedInRedirect = async (req, res, next) => {
  const isLoggedIn = await checkLogin()
  if (isLoggedIn) {
    return res.redirect('/tg/')
  }
  next()
}

module.exports = {
  requireTelegramLogin,
  loggedInRedirect,
}