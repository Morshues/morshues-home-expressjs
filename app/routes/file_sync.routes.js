const express = require('express')
const multer = require('multer')
const router = express.Router()
const ctrl = require('../controllers/file_sync.controller')
const service = require('../services/file_sync.service')
const { jwtAuth } = require('../middlewares/jwt_auth')
const { validateFolderId, validateFileName } = require("../middlewares/file_sync_validation")

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    service.ensureFolder(req.userId, req.folderId)
      .then(dir => cb(null, dir))
      .catch(cb)
  },
  filename: (req, file, cb) => {
    const sanitizedName = service.normalizeFileName(file.originalname)
    if (!sanitizedName) return cb(new Error('invalid file name'))
    cb(null, sanitizedName)
  }
})

const upload = multer({ storage })

router.param('folderId', validateFolderId)
router.param('fileName', validateFileName)

router.get('/:folderId/files', jwtAuth, ctrl.listFolder)
router.post('/:folderId/sync', jwtAuth, ctrl.syncFolder)
router.post('/:folderId/upload', jwtAuth, upload.single('file'), ctrl.uploadFile)
router.get('/:folderId/files/:fileName/download', jwtAuth, ctrl.downloadFile)
router.delete('/:folderId/files/:fileName', jwtAuth, ctrl.deleteFile)

module.exports = router
