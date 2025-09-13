const express = require('express')
const router = express.Router()
const ctrl = require('../controllers/auth.api.controller')
const { jwtAuth } = require('../middlewares/jwt_auth')

router.post('/login', ctrl.loginJson)
router.post('/refresh', ctrl.refresh)
router.post('/logout', ctrl.logoutJson)

router.get('/devices', jwtAuth, ctrl.listMyDevices)

module.exports = router
