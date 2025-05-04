
exports.index = async (req, res) => {
  res.render('upload/index');
}

exports.upload = async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }
  res.send(`${req.file.originalname} uploaded`);
}
