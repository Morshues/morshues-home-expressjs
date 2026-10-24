'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tg_group', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
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

    await queryInterface.addConstraint('tg_group', {
      fields: ['user_id', 'name'],
      type: 'unique',
      name: 'tg_group_user_name',
    })

    await queryInterface.addColumn('tg_viewed_history', 'group_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'tg_group', key: 'id' },
      onDelete: 'SET NULL',
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('tg_viewed_history', 'group_id')
    await queryInterface.dropTable('tg_group')
  },
}
