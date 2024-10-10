const express = require('express')
const router = express.Router()
const urlController = require('../controllers/url.controller')

const subPath = 'url'

router.get(`/${subPath}/`, urlController.showList)

router.post(`/${subPath}/shorten`, urlController.createShortUrl)

router.get('/u/:shortCode', urlController.redirectToOriginalUrl)

module.exports = router