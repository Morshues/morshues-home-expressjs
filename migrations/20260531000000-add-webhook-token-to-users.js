'use strict'

const crypto = require('crypto')

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'webhook_token', {
      type: Sequelize.STRING(64),
      allowNull: true,
      unique: true,
    })

    const [users] = await queryInterface.sequelize.query('SELECT id FROM users')
    for (const { id } of users) {
      const token = crypto.randomBytes(24).toString('base64url')
      await queryInterface.sequelize.query(
        'UPDATE users SET webhook_token = :token WHERE id = :id',
        { replacements: { token, id } }
      )
    }

    await queryInterface.changeColumn('users', 'webhook_token', {
      type: Sequelize.STRING(64),
      allowNull: false,
      unique: true,
    })

    await queryInterface.addIndex('users', ['webhook_token'], {
      unique: true,
      name: 'users_webhook_token_unique',
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('users', 'users_webhook_token_unique')
    await queryInterface.removeColumn('users', 'webhook_token')
  },
}