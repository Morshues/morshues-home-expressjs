const express = require('express')
const router = express.Router()
const controller = require('../controllers/link_page.controller')

router.get('/', controller.index)

router.get('/list', controller.list)

router.post('/create', controller.create)

router.post('/delete', controller.delete)

module.exports = router