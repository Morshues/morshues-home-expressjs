require('dotenv').config();

module.exports = {
  HOST: process.env.DB_HOST || 'localhost',
  PORT: process.env.DB_PORT || 5432,
  USER: process.env.DB_USER,
  PASSWORD: process.env.DB_PASSWORD,
  DB: process.env.DB_NAME || 'morshues_home',
  DIALECT: 'postgres',
  POOL: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
};