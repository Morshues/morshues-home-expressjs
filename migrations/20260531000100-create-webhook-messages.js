'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('webhook_messages', {
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
      channel: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      source_ip: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      headers: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      body: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      received_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    })

    await queryInterface.addIndex('webhook_messages', ['user_id', 'channel', 'received_at'], {
      name: 'webhook_messages_user_channel_received_idx',
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('webhook_messages')
  },
}