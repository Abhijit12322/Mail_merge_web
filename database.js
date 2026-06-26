const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'mergemail.db');
const db = new sqlite3.Database(dbPath);

// Promise-based DB wrappers
const dbRun = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve(this); // Contains 'lastID' and 'changes'
    });
  });
};

const dbGet = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Initialize Tables
async function initDb() {
  // Users Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migrate users table if email column is missing
  try {
    await dbRun('ALTER TABLE users ADD COLUMN email TEXT');
    console.log('Migrated: Added email column to users table.');
  } catch (err) {
    // Column already exists, ignore
  }

  // Sessions Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_active_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      logout_time DATETIME,
      duration_seconds INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Pending Users Table (for registration verification code)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS pending_users (
      email TEXT UNIQUE PRIMARY KEY,
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      verification_code TEXT NOT NULL,
      expires_at DATETIME NOT NULL
    )
  `);

  // Migrate pending_users table if username column is missing
  try {
    await dbRun('ALTER TABLE pending_users ADD COLUMN username TEXT');
    console.log('Migrated: Added username column to pending_users table.');
  } catch (err) {
    // Column already exists, ignore
  }

  console.log('Database tables verified/created successfully.');

  // Seed default admin if no users exist
  const existingAdmin = await dbGet('SELECT * FROM users WHERE username = ?', ['admin']);
  if (!existingAdmin) {
    const defaultPassword = 'admin123';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(defaultPassword, salt);
    await dbRun('INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)', ['admin', hash, 'admin@localhost']);
    console.log('Default admin user seeded successfully (admin / admin123).');
  }
}

module.exports = {
  db,
  dbRun,
  dbGet,
  dbAll,
  initDb
};
