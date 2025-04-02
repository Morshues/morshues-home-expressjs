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

db.Url = require('./url.model.js')(sequelize, Sequelize)
db.TgViewedHistory = require('./tg.model.js')(sequelize, Sequelize)

module.exports = db