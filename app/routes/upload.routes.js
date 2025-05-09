const express = require('express');
const router = express.Router();
const controller = require("../controllers/upload.controller");
const multer = require("multer");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    file.utf8Name = Buffer.from(file.originalname, 'latin1').toString('utf8')
    cb(null, Date.now() + '-' + file.utf8Name)
  }
});
const upload = multer({ storage });

router.get('/', controller.index)

router.post('/', upload.single('file'), controller.upload)

module.exports = router;