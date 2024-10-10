const db = require('../models')
const { ValidationError } = require("sequelize")
const Url = db.Url

const FLASH_LAST_URL = 'lastUrl'
const FLASH_URL_GENERATION_ERROR = 'urlGenerationError'

exports.showList = async (req, res) => {
  const urls = await Url.findAll({
    order: [
      ['id', 'DESC']
    ]
  })
  const toShowHistory = urls.map(url => url.get({ plain: true }))
  res.render('url/list', {
    history: toShowHistory,
    error: req.flash(FLASH_URL_GENERATION_ERROR),
    lastUrl: req.flash(FLASH_LAST_URL),
  })
}

exports.createShortUrl = async (req, res) => {
  try {
    const originalUrl = req.body.originalUrl?.trim()

    let url = await Url.findOne({ where: { originalUrl } })
    let urlExist = url != null
    if (!urlExist) {
      url = await Url.create({ originalUrl })
    }
    let shortUrl = `${req.protocol}://${req.headers.host}/u/${url.shortCode}`
    req.flash(FLASH_LAST_URL, shortUrl)
    res.redirect('/url')
  } catch (error) {
    if (error instanceof ValidationError) {
      req.flash(FLASH_URL_GENERATION_ERROR, error.message)
    } else {
      req.flash(FLASH_URL_GENERATION_ERROR, 'Error while creating a short url')
    }
    res.redirect('/url')
  }
}

exports.redirectToOriginalUrl = async (req, res) => {
  try {
    const {shortCode} = req.params

    const url = await Url.findOne({ where: { shortCode } })

    if (!url) {
      return res.status(404).send('Short url not exist')
    }

    await url.incrementClicks()

    res.redirect(url.originalUrl)
  } catch (error) {
    res.status(500).send('Error while redirect')
  }
}