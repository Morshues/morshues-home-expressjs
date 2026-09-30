const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const router = express.Router();
const browseLibraryController = require('../controllers/browse_library.controller')
const { ensureAuthenticatedApi } = require('../middlewares/auth')

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = browseLibraryController.resolveInVideoDir(req.query.dir || '');
    if (!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      return cb(httpError(400, 'invalid target folder'));
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    file.utf8Name = Buffer.from(file.originalname, 'latin1').toString('utf8')
    const target = path.join(browseLibraryController.resolveInVideoDir(req.query.dir || ''), file.utf8Name);
    if (fs.existsSync(target)) {
      return cb(httpError(409, `${file.utf8Name} already exists`));
    }
    cb(null, file.utf8Name)
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const name = Buffer.from(file.originalname, 'latin1').toString('utf8')
    if (/[\\/]/.test(name) || !browseLibraryController.VIDEO_EXT.test(name)) {
      return cb(httpError(400, `${name} is not a supported video file`));
    }
    cb(null, true);
  },
});

router.get('/', browseLibraryController.index);

router.get('/list', browseLibraryController.itemList);

router.get('/thumbnails/{*filename}', browseLibraryController.getThumbnail);

router.get('/v/{*filename}', browseLibraryController.streamVideo);

router.post('/upload', ensureAuthenticatedApi, upload.array('files'), browseLibraryController.uploadVideos);

router.delete('/v/{*filename}', ensureAuthenticatedApi, browseLibraryController.deleteVideo);

router.post('/folder', ensureAuthenticatedApi, browseLibraryController.createFolder);

router.delete('/folder/{*dirname}', ensureAuthenticatedApi, browseLibraryController.deleteFolder);

// Return upload / management errors as JSON
router.use((err, req, res, next) => {
  const status = err.status || (err instanceof multer.MulterError ? 400 : 500);
  if (status === 500) console.error(err);
  res.status(status).json({ error: err.message });
});

module.exports = router;
