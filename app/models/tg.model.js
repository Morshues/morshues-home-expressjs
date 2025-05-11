module.exports = (sequelize, DataTypes) => {
  const TgViewedHistory = sequelize.define('TgViewedHistory', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    messageUrl: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true,
      validate: {
        isUrl: {
          args: true,
          msg: 'Invalid URL format'
        },
        notNull: {
          msg: 'URL is required'
        }
      }
    },
    filename: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '',
    },
    duration: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    lastViewedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    nsfw: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
  }, {
    timestamps: false,
    tableName: 'tg_viewed_history',
    underscored: true
  })

  TgViewedHistory.prototype.updateLastViewed = async function () {
    this.lastViewedAt = new Date()
    await this.save()
  }

  return TgViewedHistory
}