#!/usr/bin/env node
/**
 * Migration script: Neon PostgreSQL → Turso
 *
 * Usage:
 *   1. Set NEON_DATABASE_URL to your Neon connection string
 *   2. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN for your Turso database
 *   3. Run: node migrate-from-neon.js
 *
 * This script reads all data from Neon and inserts it into Turso.
 * Run it once after setting up Turso.
 */

import { createClient } from '@libsql/client';
import pg from 'pg';

const NEON_URL = process.env.NEON_DATABASE_URL;
if (!NEON_URL) {
  console.error('Set NEON_DATABASE_URL environment variable');
  console.error('Example: postgresql://user:pass@ep-xxx.region.neon.tech/dbname?sslmode=require');
  process.exit(1);
}

const turso = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:local.db',
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

const neon = new pg.Pool({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });

async function migrate() {
  console.log('Initializing Turso schema...');

  await turso.batch([
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
  ]);

  // Migrate users
  console.log('Migrating users...');
  const { rows: users } = await neon.query('SELECT * FROM users');
  console.log(`  Found ${users.length} users`);

  for (const u of users) {
    try {
      await turso.execute({
        sql: `INSERT OR IGNORE INTO users (id, email, password, name, plan, role, company, embedKey, status, notes, websiteUrl, brandColors, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          u.id, u.email, u.password, u.name || '',
          u.plan || 'free', u.role || 'user', u.company || '',
          u.embed_key || u.embedKey || 'ek_' + u.id,
          u.status || 'active', u.notes || '',
          u.website_url || u.websiteUrl || '',
          JSON.stringify(u.brand_colors || u.brandColors || {}),
          u.created_at || u.createdAt || new Date().toISOString(),
          u.updated_at || u.updatedAt || new Date().toISOString(),
        ],
      });
    } catch (err) {
      console.error(`  Failed to migrate user ${u.email}: ${err.message}`);
    }
  }

  // Migrate boards
  console.log('Migrating boards...');
  const { rows: boards } = await neon.query('SELECT * FROM boards');
  console.log(`  Found ${boards.length} boards`);

  for (const b of boards) {
    try {
      const { id, embed_id, embedId, user_id, userId, type, status, board_name, boardName,
              views, clicks, created_at, createdAt, updated_at, updatedAt, ...rest } = b;

      const data = JSON.stringify(rest);

      await turso.execute({
        sql: `INSERT OR IGNORE INTO boards (id, embedId, userId, type, status, boardName, data, views, clicks, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          embed_id || embedId || id,
          user_id || userId,
          type || 'blog',
          status || 'draft',
          board_name || boardName || '',
          data,
          views || 0,
          clicks || 0,
          created_at || createdAt || new Date().toISOString(),
          updated_at || updatedAt || new Date().toISOString(),
        ],
      });
    } catch (err) {
      console.error(`  Failed to migrate board ${b.id}: ${err.message}`);
    }
  }

  // Migrate areas
  console.log('Migrating areas...');
  try {
    const { rows: areas } = await neon.query('SELECT * FROM areas');
    console.log(`  Found ${areas.length} areas`);

    for (const a of areas) {
      await turso.execute({
        sql: 'INSERT OR IGNORE INTO areas (id, userId, name, description) VALUES (?, ?, ?, ?)',
        args: [a.id, a.user_id || a.userId, a.name, a.description || ''],
      });
    }
  } catch (err) {
    console.log(`  Areas table not found or empty: ${err.message}`);
  }

  await neon.end();

  console.log('\nMigration complete!');
  console.log('Update js/config.js with your new backend URL.');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
