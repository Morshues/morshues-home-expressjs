const LocalStrategy = require('passport-local').Strategy
const bcrypt = require('bcrypt')
const db = require('../models')
const User = db.User

module.exports = function (passport) {
  // Login Logic
  passport.use(new LocalStrategy({
    usernameField: 'email',
  }, async (email, password, done) => {
    try {
      const user = await User.findOne({ where: { email } })
      if (!user) return done(null, false, { message: 'Account Not Exists' })

      const match = await bcrypt.compare(password, user.password)
      if (!match) return done(null, false, { message: 'Wrong Password' })

      return done(null, user)
    } catch (err) {
      return done(err)
    }
  }))

  // Save user info to session
  passport.serializeUser((user, done) => {
    done(null, user.id)
  })

  // Load session to get user info
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await db.User.findByPk(id, {
        include: [{ model: db.Admin, as: 'adminInfo' }]
      })
      done(null, user)
    } catch (err) {
      done(err)
    }
  })
}