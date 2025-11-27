const { Admin } = require('../models')

const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) return next()
  res.redirect('/auth/login')
}

const requireAdmin = async (req, res, next) => {
  if (!req.isAuthenticated?.()) {
    return res.status(401).send('Please Login to check this page')
  }

  const userId = req.user.id
  const isAdmin = await Admin.findOne({ where: { user_id: userId } })

  if (!isAdmin) {
    return res.status(403).send('You are not allowed to see this page')
  }

  next()
}

module.exports = {
  ensureAuthenticated,
  requireAdmin,
}
