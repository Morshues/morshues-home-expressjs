module.exports = (sequelize, DataTypes) => {
  const LinkPage = sequelize.define('LinkPage', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    url: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { isUrl: true },
    },
    title: {
      type: DataTypes.STRING,
      defaultValue: '',
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
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
    tableName: 'link_page',
    underscored: true
  })

  LinkPage.prototype.updateLastViewed = async function () {
    this.lastViewedAt = new Date()
    await this.save()
  }

  return LinkPage
}