import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:local.db',
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

export async function initDb() {
  await db.batch([
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT DEFAULT '',
      plan TEXT DEFAULT 'free',
      role TEXT DEFAULT 'user',
      company TEXT DEFAULT '',
      embedKey TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'active',
      notes TEXT DEFAULT '',
      websiteUrl TEXT DEFAULT '',
      brandColors TEXT DEFAULT '{}',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS boards (
      id TEXT PRIMARY KEY,
      embedId TEXT UNIQUE NOT NULL,
      userId TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'blog',
      status TEXT DEFAULT 'draft',
      boardName TEXT DEFAULT '',
      data TEXT NOT NULL DEFAULT '{}',
      views INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS areas (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT ''
    )`,
    `CREATE INDEX IF NOT EXISTS idx_boards_userId ON boards(userId)`,
    `CREATE INDEX IF NOT EXISTS idx_boards_embedId ON boards(embedId)`,
    `CREATE INDEX IF NOT EXISTS idx_boards_status ON boards(status)`,
    `CREATE INDEX IF NOT EXISTS idx_boards_type ON boards(type)`,
    `CREATE INDEX IF NOT EXISTS idx_areas_userId ON areas(userId)`,
    `CREATE INDEX IF NOT EXISTS idx_users_embedKey ON users(embedKey)`,
  ]);
}

export default db;
