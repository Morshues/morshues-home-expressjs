const crypto = require('crypto')

module.exports = (sequelize, DataTypes) => {
  const Url = sequelize.define('Url', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    originalUrl: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        isUrl: {
          args: true,
          msg: 'Original url invalid'
        },
        notNull: {
          msg: 'Original url can not be null',
        },
      }
    },
    shortCode: {
      type: DataTypes.STRING(6),
      allowNull: false,
      unique: true
    },
    clicks: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
  }, {
    timestamps: true,
    tableName: 'shortened_urls',
    underscored: true,
    hooks: {
      beforeValidate: async (url, options) => {
        if (!url.shortCode) {
          url.shortCode = await generateUniqueShortCode()
        }
      }
    }
  })

  async function generateUniqueShortCode() {
    let shortCode
    let exists = true

    while (exists) {
      shortCode = crypto.randomBytes(4).toString('base64url')
      const count = await sequelize.models.Url.count({ where: { shortCode } })
      if (count === 0) {
        exists = false
      }
    }

    return shortCode
  }

  Url.associate = function(models) {
    // empty
  }

  Url.prototype.incrementClicks = async function() {
    this.clicks += 1
    await this.save()
  }

  return Url
}