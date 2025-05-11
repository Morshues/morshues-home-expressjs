const express = require('express')
const router = express.Router()
const controller = require('../controllers/link_page.controller')

router.get('/', controller.index)

router.post('/list', controller.list)

router.post('/create', controller.create)

router.post('/:id/edit', controller.edit)

router.post('/:id/delete', controller.delete)

module.exports = router