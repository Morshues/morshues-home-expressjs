const express = require('express')
const router = express.Router()
const urlController = require('../controllers/url.controller')

router.get('/', urlController.showList)

router.post('/shorten', urlController.createShortUrl)

router.get('/:shortCode', urlController.redirectToOriginalUrl)

module.exports = router