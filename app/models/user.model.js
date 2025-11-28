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
    }
  }, {
    tableName: 'users',
    timestamps: true
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
  }

  return User
}
