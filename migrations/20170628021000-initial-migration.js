'use strict';

const database = require('../database');


module.exports = {
  up: function (queryInterface, Sequelize) {
    database.sync();
  },

  down: function (queryInterface, Sequelize) {
    database.drop();
  }
};
