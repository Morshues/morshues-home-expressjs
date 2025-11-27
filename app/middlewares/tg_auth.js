const { checkLogin } = require('../services/tg_client')

const requireTelegramLogin = async (req, res, next) => {
  if (!req.isAuthenticated?.() || !req.user) {
    return res.redirect('/auth/login')
  }

  const isTgLoggedIn = await checkLogin(req.user.id)
  if (!isTgLoggedIn) {
    return res.redirect('/tg/login')
  }
  next()
}

const loggedInRedirect = async (req, res, next) => {
  if (!req.isAuthenticated?.() || !req.user) {
    return res.redirect('/auth/login')
  }

  const isTgLoggedIn = await checkLogin(req.user.id)
  if (isTgLoggedIn) {
    return res.redirect('/tg/')
  }
  next()
}

module.exports = {
  requireTelegramLogin,
  loggedInRedirect,
}
