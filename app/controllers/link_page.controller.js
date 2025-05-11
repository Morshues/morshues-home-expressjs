const db = require('../models')
const LinkPage = db.LinkPage

exports.index = async (req, res) => {
  try {
    const links = await LinkPage.findAll({ order: [['createdAt', 'DESC']] })
    const toShowLinks = links.map(url => url.get({ plain: true }))
    res.render('link_page/index', { links: toShowLinks })
  } catch (err) {
    res.status(500).send(err.message)
  }
}

exports.create = async (req, res) => {
  const { url, title } = req.body
  if (!url) return res.status(400).send('Missing URL')
  const decodedUrl = decodeURIComponent(url);
  try {
    await LinkPage.create({ url: decodedUrl, title })
    res.redirect('/link-page/')
  } catch (err) {
    res.status(500).send(err.message)
  }
}

exports.list = async (req, res) => {
  const list = await LinkPage.findAll({
    order: [['lastViewedAt', 'DESC']]
  })
  res.json(list)
}

exports.edit = async (req, res) => {
  const id = req.params.id
  const { title, nsfw } = req.body

  const record = await LinkPage.findByPk(id)
  if (!record) {
    return res.status(404).send('Not found')
  }

  if (title !== undefined) {
    record.title = title
  }
  if (nsfw !== undefined) {
    record.nsfw = nsfw === 'true' || nsfw === true
  }

  await record.save()
  res.send(record)
}

exports.delete = async (req, res) => {
  const id = req.params.id
  await LinkPage.destroy({
    where: {id}
  })
  res.redirect('/link-page/')
}