'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('RefreshTokens', {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE', onUpdate: 'CASCADE'
      },
      token_hash: { type: Sequelize.STRING(128), allowNull: false }, // sha256
      device_id:  { type: Sequelize.STRING(64), allowNull: false },  // 由 App 生成 UUID
      user_agent: { type: Sequelize.STRING(255) },
      ip:         { type: Sequelize.STRING(64) },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      revoked_at: { type: Sequelize.DATE },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('RefreshTokens', ['user_id']);
    await queryInterface.addIndex('RefreshTokens', ['device_id']);
    await queryInterface.addIndex('RefreshTokens', ['token_hash'], { unique: true, name: 'rt_token_hash_unique' });
    await queryInterface.addConstraint('RefreshTokens', {
      fields: ['user_id', 'device_id'],
      type: 'unique',
      name: 'refresh_tokens_user_device_unique'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('RefreshTokens');
  }
};
