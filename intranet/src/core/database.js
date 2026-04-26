const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const config = require('../config');

const DATA_DIR = config.dataDir;
const DB_PATH = path.join(DATA_DIR, 'network.db');
const DB_BACKUP_PATH = path.join(DATA_DIR, 'network.db.backup');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let db = null;
let SQL = null;
let autoSaveInterval = null;
let pendingChanges = false;

function loadDatabaseFile() {
  if (fs.existsSync(DB_PATH)) {
    try {
      const buffer = fs.readFileSync(DB_PATH);
      const testDb = new SQL.Database(buffer);
      testDb.exec('SELECT 1');
      console.log('[DB] Loaded database from disk');
      return testDb;
    } catch (err) {
      console.warn('[DB] Main database corrupted, trying backup...');
      if (fs.existsSync(DB_BACKUP_PATH)) {
        try {
          const backupBuffer = fs.readFileSync(DB_BACKUP_PATH);
          const backupDb = new SQL.Database(backupBuffer);
          backupDb.exec('SELECT 1');
          console.log('[DB] Loaded backup database');
          return backupDb;
        } catch (backupErr) {
          console.warn('[DB] Backup also corrupted, creating new database');
        }
      }
    }
  }
  console.log('[DB] Creating new database');
  return new SQL.Database();
}

async function initDatabase() {
  SQL = await initSqlJs();
  db = loadDatabaseFile();

  db.run(`
    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL,
      ws_port INTEGER,
      online INTEGER DEFAULT 0,
      last_seen INTEGER DEFAULT 0,
      metadata TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      size INTEGER NOT NULL,
      mime_type TEXT,
      hash TEXT,
      shared INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL,
      receiver_id TEXT,
      content TEXT NOT NULL,
      type TEXT DEFAULT 'text',
      timestamp INTEGER DEFAULT (strftime('%s', 'now')),
      read INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_nodes_online ON nodes(online)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_files_node_id ON files(node_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_files_hash ON files(hash)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC)`);

  saveDatabaseSync();

  if (autoSaveInterval) clearInterval(autoSaveInterval);
  autoSaveInterval = setInterval(() => {
    if (pendingChanges) {
      saveDatabaseSync();
      pendingChanges = false;
    }
  }, 5000);

  console.log('[DB] Database initialized (sql.js, data dir:', DATA_DIR + ')');
  return db;
}

function saveDatabaseSync() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    if (fs.existsSync(DB_PATH)) fs.copyFileSync(DB_PATH, DB_BACKUP_PATH);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.error('[DB] Failed to save database:', err.message);
  }
}

function saveDatabase() {
  pendingChanges = true;
  saveDatabaseSync();
}

function getDb() { return db; }

function closeDatabase() {
  if (autoSaveInterval) { clearInterval(autoSaveInterval); autoSaveInterval = null; }
  if (db) { saveDatabaseSync(); db = null; console.log('[DB] Database saved and connection closed'); }
}

// ===== Node Operations =====
const nodeOps = {
  insert: (data) => {
    db.run(`INSERT OR REPLACE INTO nodes (id, name, host, port, ws_port, online, last_seen, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.id, data.name, data.host, data.port, data.wsPort || null,
       data.online || 0, data.lastSeen || Math.floor(Date.now() / 1000), data.metadata || null]);
    pendingChanges = true;
  },
  updateOnline: (online, lastSeen, id) => {
    db.run(`UPDATE nodes SET online = ?, last_seen = ? WHERE id = ?`, [online, lastSeen, id]);
    pendingChanges = true;
  },
  getAll: () => resultToArray(db.exec(`SELECT * FROM nodes`)),
  getOnline: () => resultToArray(db.exec(`SELECT * FROM nodes WHERE online = 1`)),
  getById: (id) => {
    const stmt = db.prepare(`SELECT * FROM nodes WHERE id = ?`);
    stmt.bind([id]);
    const row = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return row;
  },
  delete: (id) => { db.run(`DELETE FROM nodes WHERE id = ?`, [id]); pendingChanges = true; }
};

// ===== File Operations =====
const fileOps = {
  insert: (data) => {
    db.run(`INSERT OR REPLACE INTO files (id, node_id, name, path, size, mime_type, hash, shared)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.id, data.nodeId, data.name, data.path, data.size,
       data.mimeType || null, data.hash || null, data.shared !== undefined ? data.shared : 1]);
    pendingChanges = true;
  },
  getAll: () => resultToArray(db.exec(`SELECT * FROM files ORDER BY created_at DESC`)),
  getByNode: (nodeId) => resultToArray(db.exec(`SELECT * FROM files WHERE node_id = '${nodeId.replace(/'/g, "''")}' ORDER BY created_at DESC`)),
  getByHash: (hash) => {
    const stmt = db.prepare(`SELECT * FROM files WHERE hash = ?`);
    stmt.bind([hash]);
    const row = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return row;
  },
  getById: (id) => {
    const stmt = db.prepare(`SELECT * FROM files WHERE id = ?`);
    stmt.bind([id]);
    const row = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return row;
  },
  delete: (id) => { db.run(`DELETE FROM files WHERE id = ?`, [id]); pendingChanges = true; }
};

// ===== Message Operations =====
const msgOps = {
  insert: (data) => {
    db.run(`INSERT INTO messages (id, sender_id, receiver_id, content, type, timestamp, read)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [data.id, data.senderId, data.receiverId || null, data.content,
       data.type || 'text', data.timestamp || Math.floor(Date.now() / 1000), data.read !== undefined ? data.read : 0]);
    pendingChanges = true;
  },
  getAll: (limit) => resultToArray(db.exec(`SELECT * FROM messages ORDER BY timestamp DESC LIMIT ${limit || 100}`)),
  getConversation: (nodeId, otherNodeId) => {
    const a = nodeId.replace(/'/g, "''");
    const b = otherNodeId.replace(/'/g, "''");
    return resultToArray(db.exec(`
      SELECT * FROM messages
      WHERE (sender_id = '${a}' AND receiver_id = '${b}')
         OR (sender_id = '${b}' AND receiver_id = '${a}')
      ORDER BY timestamp ASC`));
  },
  markRead: (nodeId) => {
    db.run(`UPDATE messages SET read = 1 WHERE receiver_id = '${nodeId.replace(/'/g, "''")}' AND read = 0`);
    pendingChanges = true;
  },
  getUnreadCount: (nodeId) => {
    const r = db.exec(`SELECT COUNT(*) as count FROM messages WHERE receiver_id = '${nodeId.replace(/'/g, "''")}' AND read = 0`);
    return (r.length > 0 && r[0].values.length > 0) ? r[0].values[0][0] : 0;
  },
  getContacts: (nodeId) => {
    const safe = nodeId.replace(/'/g, "''");
    return resultToArray(db.exec(`
      SELECT
        CASE WHEN sender_id = '${safe}' THEN receiver_id ELSE sender_id END as contact_id,
        MAX(timestamp) as last_message_time,
        SUM(CASE WHEN receiver_id = '${safe}' AND read = 0 THEN 1 ELSE 0 END) as unread_count
      FROM messages
      WHERE sender_id = '${safe}' OR receiver_id = '${safe}'
      GROUP BY contact_id
      ORDER BY last_message_time DESC`));
  }
};

// ===== Settings Operations =====
const settingsOps = {
  get: (key) => {
    const stmt = db.prepare(`SELECT value FROM settings WHERE key = ?`);
    stmt.bind([key]);
    const row = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return row;
  },
  set: (key, value) => {
    db.run(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [key, value]);
    pendingChanges = true;
  },
  getAll: () => resultToArray(db.exec(`SELECT * FROM settings`))
};

function resultToArray(result) {
  if (!result || result.length === 0) return [];
  const columns = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => obj[col] = row[i]);
    return obj;
  });
}

module.exports = { initDatabase, getDb, saveDatabase, closeDatabase, nodes: nodeOps, files: fileOps, messages: msgOps, settings: settingsOps };
