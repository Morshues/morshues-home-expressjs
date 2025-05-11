const express = require('express')
const router = express.Router()
const tgController = require('../controllers/tg.controller')
const { requireTelegramLogin, loggedInRedirect }  = require('../middlewares/tg_auth');


router.get(`/`, requireTelegramLogin, tgController.index)

router.get(`/video`, requireTelegramLogin, tgController.video)

router.get(`/video_thumbs`, requireTelegramLogin, tgController.videoThumbnail)

router.get(`/login`, loggedInRedirect, tgController.login)

router.post(`/code`, loggedInRedirect, tgController.code)

router.post(`/connect`, requireTelegramLogin, tgController.connect)

router.post(`/list`, requireTelegramLogin, tgController.list)

router.post('/:id/edit', requireTelegramLogin, tgController.edit)

router.post(`/:id/delete`, requireTelegramLogin, tgController.delete)

module.exports = router