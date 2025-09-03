const bcrypt = require('bcrypt')
const db = require('../models')
const passport = require("passport")
const User = db.User

exports.showLogin = (req, res) => {
  res.render('auth/login', {
    showUserStatus: true
  })
}
exports.showRegister = (req, res) =>  {
  res.render('auth/register', {
    showUserStatus: true
  })
}

exports.login = (req, res, next) => {
  passport.authenticate('local', async (err, user, info) => {
    if (err) return next(err)
    if (!user) {
      req.flash('error', info?.message || 'Login failed')
      return res.redirect('/auth/login')
    }

    req.logIn(user, async (err) => {
      if (err) return next(err)

      user.lastLogin = new Date()
      await user.save()

      return res.redirect('/user')
    })
  })(req, res, next)
}

exports.register = async (req, res) => {
  const { email, password, name } = req.body
  const hash = await bcrypt.hash(password, 10)
  try {
    await User.create({ email, password: hash, name, provider: 'local' })
    res.redirect('/auth/login')
  } catch (err) {
    res.status(500).send('Register failed: ' + err.message)
  }
}

exports.user = (req, res) => {
  res.render('auth/user', {
    title: 'User',
    showUserStatus: true,
  })
}

exports.logout = (req, res) => {
  req.logout(() => {
    res.redirect('/auth/login')
  })
}
