
exports.index = async (req, res) => {
  res.render('upload/index');
}

exports.upload = async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).send('No file uploaded.');
  }
  const names = req.files.map(f => f.utf8Name || f.originalname)
  res.send(`${names.join(', ')} uploaded`)
}
