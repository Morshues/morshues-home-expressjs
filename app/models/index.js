const { Sequelize } = require('sequelize')
const dbConfig = require('../config/db.config.js')

const sequelize = new Sequelize(dbConfig.DB, dbConfig.USER, dbConfig.PASSWORD, {
  host: dbConfig.HOST,
  port: dbConfig.PORT,
  dialect: dbConfig.DIALECT,
  pool: dbConfig.POOL,
})

sequelize.authenticate()
  .then(() => {
    console.log('Connected to the database')
  })
  .catch(err => {
    console.error('Unable to connect to the database：', err)
  })

const db = {}
db.Sequelize = Sequelize
db.sequelize = sequelize

db.User = require('./user.model')(sequelize, Sequelize)
db.Admin = require('./admin.model')(sequelize, Sequelize)
db.RefreshToken = require('./refresh_token.model')(sequelize, Sequelize)
db.Url = require('./url.model.js')(sequelize, Sequelize)
db.TgViewedHistory = require('./tg.model.js')(sequelize, Sequelize)
db.TgAbbr = require('./tg_abbr.model')(sequelize, Sequelize)
db.LinkPage = require('./link_page.model')(sequelize, Sequelize)
db.TelegramSession = require('./telegram_session.model')(sequelize, Sequelize)

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db)
  }
})

module.exports = db