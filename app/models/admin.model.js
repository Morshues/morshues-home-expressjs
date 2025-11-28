module.exports = (sequelize, DataTypes) => {
  const Admin = sequelize.define('Admin', {
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true
    }
  }, {
    tableName: 'admins',
    timestamps: true
  })

  Admin.associate = models => {
    Admin.belongsTo(models.User, {
      foreignKey: 'user_id',
      onDelete: 'CASCADE'
    })
  }

  return Admin
}
