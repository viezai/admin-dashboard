import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'contacts.db');

let dbInstance = null;

/**
 * Persist in-memory WASM SQLite buffer to disk
 */
function persistDatabase() {
  if (!dbInstance) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const data = dbInstance.export();
    fs.writeFileSync(DB_FILE, Buffer.from(data));
  } catch (err) {
    console.error('[DB] Failed to persist contacts.db:', err);
  }
}

/**
 * Initialize SQLite Database
 */
export async function initDatabase() {
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE);
      dbInstance = new SQL.Database(fileBuffer);
    } catch (err) {
      console.warn('[DB] Existing DB file corrupted or unreadable. Creating fresh one.', err);
      dbInstance = new SQL.Database();
    }
  } else {
    dbInstance = new SQL.Database();
  }

  // Ensure table schema
  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      company TEXT NOT NULL,
      need TEXT DEFAULT 'General AI Agent Consultation',
      message TEXT DEFAULT '',
      status TEXT DEFAULT 'new',
      notes TEXT DEFAULT '',
      ip_address TEXT DEFAULT '',
      user_agent TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  persistDatabase();
  return dbInstance;
}

/**
 * Helper to convert sql.js exec output to Array of objects
 */
function formatQueryResult(res) {
  if (!res || res.length === 0) return [];
  const { columns, values } = res[0];
  return values.map(row => {
    const obj = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj;
  });
}

/**
 * Insert a new contact submission
 */
export function insertContact({ fullName, email, company, need, message, ip, userAgent }) {
  if (!dbInstance) throw new Error('Database not initialized');

  const stmt = dbInstance.prepare(`
    INSERT INTO contacts (full_name, email, company, need, message, ip_address, user_agent, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'new', '')
  `);

  stmt.run([
    fullName,
    email,
    company,
    need || 'General AI Agent Consultation',
    message || '',
    ip || '',
    userAgent || ''
  ]);
  stmt.free();

  // Get inserted ID
  const idRes = dbInstance.exec("SELECT last_insert_rowid() AS id");
  const newId = idRes[0].values[0][0];

  persistDatabase();
  return getContactById(newId);
}

/**
 * Get single contact by ID
 */
export function getContactById(id) {
  if (!dbInstance) throw new Error('Database not initialized');
  const numId = Number(id);
  if (!Number.isFinite(numId) || numId <= 0) return null;
  const res = dbInstance.exec(`SELECT * FROM contacts WHERE id = ${numId} LIMIT 1`);
  const items = formatQueryResult(res);
  return items.length > 0 ? items[0] : null;
}

/**
 * Get contacts with filter, search and pagination
 */
export function getContacts({ search = '', status = 'all', page = 1, limit = 20 } = {}) {
  if (!dbInstance) throw new Error('Database not initialized');

  const conditions = [];

  if (status && status !== 'all') {
    conditions.push(`status = '${status.replace(/'/g, "''")}'`);
  }

  if (search && search.trim()) {
    const term = search.trim().replace(/'/g, "''");
    conditions.push(`(full_name LIKE '%${term}%' OR email LIKE '%${term}%' OR company LIKE '%${term}%' OR need LIKE '%${term}%')`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total
  const countRes = dbInstance.exec(`SELECT COUNT(*) as total FROM contacts ${whereClause}`);
  const total = countRes[0]?.values[0][0] || 0;

  // Pagination query
  const offset = (Number(page) - 1) * Number(limit);
  const query = `
    SELECT * FROM contacts
    ${whereClause}
    ORDER BY id DESC
    LIMIT ${Number(limit)} OFFSET ${Number(offset)}
  `;

  const res = dbInstance.exec(query);
  const contacts = formatQueryResult(res);

  return {
    contacts,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)) || 1
    }
  };
}

/**
 * Update contact status and internal notes
 */
export function updateContact(id, { status, notes }) {
  if (!dbInstance) throw new Error('Database not initialized');

  const current = getContactById(id);
  if (!current) return null;

  const newStatus = status !== undefined ? status : current.status;
  const newNotes = notes !== undefined ? notes : current.notes;

  const stmt = dbInstance.prepare(`
    UPDATE contacts
    SET status = ?, notes = ?, updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `);

  stmt.run([newStatus, newNotes, Number(id)]);
  stmt.free();

  persistDatabase();
  return getContactById(id);
}

/**
 * Delete a contact by ID
 */
export function deleteContact(id) {
  if (!dbInstance) throw new Error('Database not initialized');
  const current = getContactById(id);
  if (!current) return false;

  dbInstance.run(`DELETE FROM contacts WHERE id = ${current.id}`);
  persistDatabase();
  return true;
}

/**
 * Get summary KPI stats
 */
export function getStats() {
  if (!dbInstance) throw new Error('Database not initialized');

  const res = dbInstance.exec(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) AS new_leads,
      SUM(CASE WHEN status = 'contacting' THEN 1 ELSE 0 END) AS contacting,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) AS archived
    FROM contacts
  `);

  if (!res || res.length === 0) {
    return { total: 0, new_leads: 0, contacting: 0, completed: 0, archived: 0 };
  }

  const row = res[0].values[0];
  return {
    total: row[0] || 0,
    new_leads: row[1] || 0,
    contacting: row[2] || 0,
    completed: row[3] || 0,
    archived: row[4] || 0
  };
}

/**
 * Export all contacts for CSV generation
 */
export function exportAllContacts() {
  if (!dbInstance) throw new Error('Database not initialized');
  const res = dbInstance.exec("SELECT * FROM contacts ORDER BY id DESC");
  return formatQueryResult(res);
}