const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();
const controller = require("../controllers/upload.controller");
const multer = require("multer");

const uploadDir = path.join(__dirname, '../../uploads');

// A fresh server has no uploads folder yet
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    file.utf8Name = Buffer.from(file.originalname, 'latin1').toString('utf8')
    cb(null, file.utf8Name)
  }
});
const upload = multer({ storage });

router.get('/', controller.index)

router.post('/', upload.single('file'), controller.upload)

module.exports = router;