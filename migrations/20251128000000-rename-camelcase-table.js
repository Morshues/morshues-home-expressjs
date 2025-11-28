'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.renameTable('Users', 'users')
    await queryInterface.renameTable('Admins', 'admins')
    await queryInterface.renameTable('RefreshTokens', 'refresh_tokens')
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.renameTable('users', 'Users')
    await queryInterface.renameTable('admins', 'Admins')
    await queryInterface.renameTable('refresh_tokens', 'RefreshTokens')
  },
}