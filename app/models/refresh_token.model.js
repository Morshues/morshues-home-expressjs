module.exports = (sequelize, DataTypes) => {
  const RefreshToken = sequelize.define('RefreshToken', {
    tokenHash: { type: DataTypes.STRING(128), allowNull: false, field: 'token_hash', unique: true },
    deviceId:  { type: DataTypes.STRING(64),  allowNull: false, field: 'device_id' },
    userAgent: { type: DataTypes.STRING(255), field: 'user_agent' },
    ip:        { type: DataTypes.STRING(64) },
    expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
    revokedAt: { type: DataTypes.DATE, field: 'revoked_at' },
  }, {
    tableName: 'refresh_tokens',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  })

  RefreshToken.associate = (models) => {
    RefreshToken.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' })
  }

  return RefreshToken
}
