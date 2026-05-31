const crypto = require('crypto')

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    avatar: {
      type: DataTypes.STRING,
      allowNull: true
    },
    googleId: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true
    },
    provider: {
      type: DataTypes.ENUM('local', 'google'),
      defaultValue: 'local'
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    lastLogin: {
      type: DataTypes.DATE
    },
    webhookToken: {
      field: 'webhook_token',
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
  }, {
    tableName: 'users',
    timestamps: true,
    hooks: {
      beforeValidate: (user) => {
        if (!user.webhookToken) {
          user.webhookToken = crypto.randomBytes(24).toString('base64url')
        }
      },
    },
  })

  User.associate = (models) => {
    User.hasOne(models.Admin, {
      foreignKey: 'user_id',
      as: 'adminInfo',
    })

    User.hasOne(models.TelegramSession, {
      foreignKey: 'user_id',
      as: 'telegramSession',
    })

    User.hasMany(models.TgViewedHistory, {
      foreignKey: 'user_id',
      as: 'tgViewedHistory',
    })

    User.hasMany(models.WebhookMessage, {
      foreignKey: 'user_id',
      as: 'webhookMessages',
    })
  }

  return User
}