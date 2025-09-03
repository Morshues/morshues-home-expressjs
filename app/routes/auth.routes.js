const express = require('express')
const router = express.Router()
const auth = require('../controllers/auth.controller')
const { ensureAuthenticated, requireAdmin, } = require('../middlewares/auth')

router.get('/auth/login', auth.showLogin)
router.post('/auth/login', auth.login)

router.get('/auth/register', requireAdmin, auth.showRegister)
router.post('/auth/register', requireAdmin, auth.register)

router.get('/user', ensureAuthenticated, auth.user)

router.get('/auth/logout', auth.logout)

module.exports = router
