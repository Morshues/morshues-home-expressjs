module.exports = (sequelize, DataTypes) => {
  const TgAbbr = sequelize.define('TgAbbr', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    abbrRule: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    displayRule: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    timestamps: true,
    tableName: 'tg_abbr',
    underscored: true,
  })

  TgAbbr.associate = function(models) {
    // empty
  }

  return TgAbbr
}