const express = require('express');
const router = express.Router();
const browseVideoController = require('../controllers/browse_videos.controller')

router.get('/', browseVideoController.getAllVideos);

router.get('/list', browseVideoController.videoList);

router.get('/thumbnails/{*filename}', browseVideoController.getThumbnail);

router.get('/v/{*filename}', browseVideoController.streamVideo);

module.exports = router;
