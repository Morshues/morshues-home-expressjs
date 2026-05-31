const express = require('express')
const router = express.Router()
const webhookController = require('../controllers/webhook.controller')
const { ensureAuthenticated } = require('../middlewares/auth')

router.post('/api/webhook/:token/:channel', webhookController.receive)

router.get('/webhook', ensureAuthenticated, webhookController.showList)

router.post('/webhook/:id/delete', ensureAuthenticated, webhookController.deleteMessage)

module.exports = router
