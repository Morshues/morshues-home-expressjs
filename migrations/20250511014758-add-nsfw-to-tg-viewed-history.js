'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('tg_viewed_history', 'nsfw', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('tg_viewed_history', 'nsfw');
  }
};
