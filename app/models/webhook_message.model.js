module.exports = (sequelize, DataTypes) => {
  const WebhookMessage = sequelize.define('WebhookMessage', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      field: 'user_id',
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    channel: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    sourceIp: {
      field: 'source_ip',
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    headers: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    body: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    receivedAt: {
      field: 'received_at',
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    timestamps: false,
    tableName: 'webhook_messages',
    underscored: true,
  })

  WebhookMessage.associate = (models) => {
    WebhookMessage.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
      onDelete: 'CASCADE',
    })
  }

  return WebhookMessage
}