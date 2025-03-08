const express = require('express')
const router = express.Router()
const tgController = require('../controllers/tg.controller')


router.get(`/`, tgController.index)

router.get(`/video`, tgController.video)

router.get(`/login`, tgController.login)

router.post(`/code`, tgController.code)

router.post(`/connect`, tgController.connect)

router.post(`/list`, tgController.list)


module.exports = router