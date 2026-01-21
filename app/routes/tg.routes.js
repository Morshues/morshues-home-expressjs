const express = require('express')
const router = express.Router()
const tgController = require('../controllers/tg.controller')
const { requireTelegramLogin, loggedInRedirect }  = require('../middlewares/tg_auth');
const { ensureAuthenticated, } = require('../middlewares/auth')
const { jwtAuth } = require("../middlewares/jwt_auth");

router.get(`/`, ensureAuthenticated, requireTelegramLogin, tgController.index)

router.get(`/video`, ensureAuthenticated, requireTelegramLogin, tgController.video)
router.get(`/video_api`, jwtAuth, tgController.video)

router.get(`/video_thumbs`, ensureAuthenticated, requireTelegramLogin, tgController.videoThumbnail)
router.get(`/video_thumbs_api`, jwtAuth, tgController.videoThumbnail)

router.get(`/login`, ensureAuthenticated, loggedInRedirect, tgController.login)
router.post(`/login`, ensureAuthenticated, loggedInRedirect, tgController.requestCode)

router.get(`/code`, ensureAuthenticated, loggedInRedirect, tgController.codeInput)
router.post(`/code`, ensureAuthenticated, loggedInRedirect, tgController.resolveCode)

router.post(`/connect`, ensureAuthenticated, requireTelegramLogin, tgController.connect)

router.post(`/list`, ensureAuthenticated, requireTelegramLogin, tgController.list)
router.post(`/list_api`, jwtAuth, tgController.list)

router.post('/:id/edit', ensureAuthenticated, requireTelegramLogin, tgController.edit)
router.post('/:id/edit_api', jwtAuth, tgController.edit)

router.post(`/:id/delete`, ensureAuthenticated, requireTelegramLogin, tgController.delete)
router.post(`/:id/delete_api`,jwtAuth, tgController.delete)

router.post(`/abbr`, ensureAuthenticated, requireTelegramLogin, tgController.createAbbr)
router.post(`/abbr/:id`, ensureAuthenticated, requireTelegramLogin, tgController.updateAbbr)
router.post(`/abbr/:id/delete`, ensureAuthenticated, requireTelegramLogin, tgController.deleteAbbr)

module.exports = router
