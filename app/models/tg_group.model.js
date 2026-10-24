module.exports = (sequelize, DataTypes) => {
  const TgGroup = sequelize.define('TgGroup', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      field: 'user_id',
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: 'tg_group_user_name',
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: 'tg_group_user_name',
    },
    nsfw: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
  }, {
    timestamps: true,
    tableName: 'tg_group',
    underscored: true,
  })

  TgGroup.associate = (models) => {
    TgGroup.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
      onDelete: 'CASCADE'
    })
    TgGroup.hasMany(models.TgViewedHistory, {
      foreignKey: 'group_id',
      as: 'videos',
    })
  }

  return TgGroup
}
