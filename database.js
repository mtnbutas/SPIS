const Sequelize = require('sequelize');

// const db = new Sequelize({
// 	user: 'postgres',
// 	password: '2320664',
// 	name: 'spis',
// 	dialect: "postgres",
//     protocol: "postgres",
// 	host: 'localhost',
// 	port: 5432
// });

connString = 'postgres://sayunsuperuser:s@yun@127.0.0.1:5432/spis';
const database = new Sequelize(connString);

module.exports = database;