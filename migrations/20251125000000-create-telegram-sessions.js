'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('telegram_sessions', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: 'Users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      phone_number: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      session_data: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addColumn('tg_viewed_history', 'user_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    await queryInterface.removeConstraint('tg_viewed_history', 'tg_viewed_history_message_url_key').catch(() => {/* ignore if missing */})
    await queryInterface.addConstraint('tg_viewed_history', {
      fields: ['user_id', 'message_url'],
      type: 'unique',
      name: 'tg_viewed_history_user_id_message_url_key',
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint('tg_viewed_history', 'tg_viewed_history_user_id_message_url_key').catch(() => {/* ignore */})
    await queryInterface.addConstraint('tg_viewed_history', {
      fields: ['message_url'],
      type: 'unique',
      name: 'tg_viewed_history_message_url_key',
    }).catch(() => {/* ignore if already exists */})
    await queryInterface.removeColumn('tg_viewed_history', 'user_id').catch(() => {/* ignore */})
    await queryInterface.dropTable('telegram_sessions');
  },
};
