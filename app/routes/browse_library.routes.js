const express = require('express');
const router = express.Router();
const browseLibraryController = require('../controllers/browse_library.controller')

router.get('/', browseLibraryController.index);

router.get('/list', browseLibraryController.itemList);

router.get('/thumbnails/{*filename}', browseLibraryController.getThumbnail);

router.get('/v/{*filename}', browseLibraryController.streamVideo);

module.exports = router;
