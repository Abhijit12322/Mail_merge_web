const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

let pgPool = null;
const isPostgres = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL);

if (isPostgres) {
  pgPool = new Pool({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
}

const dbPath = path.join(__dirname, 'mergemail.db');
const sqliteDb = !isPostgres ? new sqlite3.Database(dbPath) : null;

// Helper to translate query placeholders from ? to $1, $2 for Postgres
function translateQuery(query) {
  if (!isPostgres) return query;
  let index = 1;
  return query.replace(/\?/g, () => `$${index++}`);
}

// Raw promise-based DB wrappers (used internally to avoid circular awaits during initialization)
const rawDbRun = (query, params = []) => {
  const sql = translateQuery(query);
  if (isPostgres) {
    return pgPool.query(sql, params);
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this); // Contains 'lastID' and 'changes'
      });
    });
  }
};

const rawDbGet = (query, params = []) => {
  const sql = translateQuery(query);
  if (isPostgres) {
    return pgPool.query(sql, params).then(res => res.rows[0] || null);
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
};

const rawDbAll = (query, params = []) => {
  const sql = translateQuery(query);
  if (isPostgres) {
    return pgPool.query(sql, params).then(res => res.rows);
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
};

// Global initialization promise cache
let initPromise = null;

// Initialize Tables
async function initDb() {
  if (isPostgres) {
    // Postgres Table Creation
    await rawDbRun(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await rawDbRun(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        token VARCHAR(255) UNIQUE NOT NULL,
        login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_active_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        logout_time TIMESTAMP,
        duration_seconds INTEGER
      )
    `);

    await rawDbRun(`
      CREATE TABLE IF NOT EXISTS pending_users (
        email VARCHAR(255) PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        password_hash TEXT NOT NULL,
        verification_code VARCHAR(10) NOT NULL,
        expires_at TIMESTAMP NOT NULL
      )
    `);
  } else {
    // SQLite Table Creation
    await rawDbRun(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migrate users table if email column is missing
    try {
      await rawDbRun('ALTER TABLE users ADD COLUMN email TEXT');
      console.log('Migrated: Added email column to users table.');
    } catch (err) {
      // Column already exists, ignore
    }

    // Sessions Table
    await rawDbRun(`
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
    await rawDbRun(`
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
      await rawDbRun('ALTER TABLE pending_users ADD COLUMN username TEXT');
      console.log('Migrated: Added username column to pending_users table.');
    } catch (err) {
      // Column already exists, ignore
    }
  }

  console.log('Database tables verified/created successfully.');

  // Seed default admin if no users exist
  const existingAdmin = await rawDbGet('SELECT * FROM users WHERE username = ?', ['admin']);
  if (!existingAdmin) {
    const defaultPassword = 'admin123';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(defaultPassword, salt);
    await rawDbRun('INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)', ['admin', hash, 'admin@localhost']);
    console.log('Default admin user seeded successfully (admin / admin123).');
  }
}

// Wrapper to ensure DB is initialized before executing any query
function ensureDbInitialized() {
  if (!initPromise) {
    initPromise = initDb();
  }
  return initPromise;
}

// Public promise-based DB wrappers (await initialization first)
const dbRun = async (query, params = []) => {
  await ensureDbInitialized();
  return rawDbRun(query, params);
};

const dbGet = async (query, params = []) => {
  await ensureDbInitialized();
  return rawDbGet(query, params);
};

const dbAll = async (query, params = []) => {
  await ensureDbInitialized();
  return rawDbAll(query, params);
};

module.exports = {
  db: sqliteDb,
  dbRun,
  dbGet,
  dbAll,
  initDb
};
