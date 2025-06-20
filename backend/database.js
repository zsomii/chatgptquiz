const Database = require('better-sqlite3');
const db = new Database('quiz.db');

module.exports = db;
