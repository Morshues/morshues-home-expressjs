module.exports = (sequelize, DataTypes) => {
  const TelegramSession = sequelize.define('TelegramSession', {
    userId: {
      field: 'user_id',
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },
    phoneNumber: {
      field: 'phone_number',
      type: DataTypes.STRING,
      allowNull: false,
    },
    sessionData: {
      field: 'session_data',
      type: DataTypes.TEXT,
      allowNull: false,
    },
  }, {
    tableName: 'telegram_sessions',
    underscored: true,
    timestamps: true,
  })

  TelegramSession.associate = (models) => {
    TelegramSession.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
      onDelete: 'CASCADE'
    })
  }

  return TelegramSession
}
