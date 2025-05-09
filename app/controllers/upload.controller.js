
exports.index = async (req, res) => {
  res.render('upload/index');
}

exports.upload = async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }
  const name = req.file.utf8Name || req.file.originalname
  res.send(`${name} uploaded`)
}
