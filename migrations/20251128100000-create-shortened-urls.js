'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('shortened_urls', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      original_url: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      short_code: {
        type: Sequelize.STRING(6),
        allowNull: false,
        unique: true,
      },
      clicks: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    })

    await queryInterface.addIndex('shortened_urls', ['short_code'], {
      unique: true,
      name: 'shortened_urls_short_code_unique',
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('shortened_urls')
  },
}
