const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '123456', // 依據您提供的 docker command，密碼設定為 123456
  database: 'voting',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function initDB() {
  try {
    // 建立資料庫與表格 (如果不存在)
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '123456'
    });
    
    await connection.query(`CREATE DATABASE IF NOT EXISTS voting;`);
    await connection.query(`USE voting;`);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS students (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uid VARCHAR(255) NOT NULL UNIQUE,
        has_voted BOOLEAN DEFAULT FALSE
      );
    `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS commitments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        value VARCHAR(255) NOT NULL
      );
    `);
    
    // 插入測試用的假學生證 UID (如果還沒有的話)
    await connection.query(`INSERT IGNORE INTO students (uid) VALUES ('E2345678'), ('A1111111'), ('B2222222');`);
    
    console.log("Database initialized.");
    connection.end();
  } catch (err) {
    console.error("DB Init Error:", err);
  }
}

initDB();

module.exports = pool;
