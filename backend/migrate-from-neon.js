#!/usr/bin/env node
/**
 * Migration: Neon PostgreSQL → Turso SQLite
 *
 * Export ALLE Daten aus Neon und importiere sie in Turso.
 * Damit hat der Nutzer nach dem Wechsel keinen Datenverlust.
 *
 * ═══════════════════════════════════════════════════════════════
 *  Setup
 * ═══════════════════════════════════════════════════════════════
 *
 * 1. Neon-Connection String holen:
 *    https://console.neon.tech/app/projects → Database → Connection string
 *    Sieht so aus: postgresql://user:pass@ep-xxx.region.neon.tech/db?sslmode=require
 *
 * 2. Turso-Datenbank erstellen:
 *    turso db create boards-solutions
 *
 * 3. Turso-Token holen:
 *    TURSO_DB_URL=$(turso db show boards-solutions --url)
 *    TURSO_TOKEN=$(turso db tokens create boards-solutions)
 *
 * 4. Migration starten:
 *    NEON_DATABASE_URL="postgresql://..." \
 *    TURSO_DATABASE_URL="libsql://..." \
 *    TURSO_AUTH_TOKEN="..." \
 *    node migrate-from-neon.js
 *
 * ═══════════════════════════════════════════════════════════════
 */

import { createClient } from '@libsql/client';

const NEON_URL = process.env.NEON_DATABASE_URL;
const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!NEON_URL) {
  console.error('❌ NEON_DATABASE_URL nicht gesetzt');
  console.error('Beispiel: postgresql://user:pass@ep-xxx.region.neon.tech/db?sslmode=require');
  process.exit(1);
}
if (!TURSO_URL) {
  console.error('❌ TURSO_DATABASE_URL nicht gesetzt');
  console.error('Beispiel: libsql://your-db-name-org.turso.io');
  process.exit(1);
}
if (!TURSO_TOKEN) {
  console.error('❌ TURSO_AUTH_TOKEN nicht gesetzt');
  process.exit(1);
}

let neonClient;
try {
  const { Client } = await import('pg');
  neonClient = new Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
  await neonClient.connect();
} catch (err) {
  console.error('❌ Kann nicht zu Neon verbinden. pg-Module installiert?');
  console.error('   npm install pg');
  process.exit(1);
}

const turso = createClient({
  url: TURSO_URL,
  authToken: TURSO_TOKEN,
});

async function migrate() {
  console.log('🚀 Migration: Neon → Turso\n');

  try {
    // 1. Schema initialisieren
    console.log('1️⃣  Initialisiere Turso-Schema...');
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
      `CREATE INDEX IF NOT EXISTS idx_boards_userId ON boards(userId)`,
      `CREATE INDEX IF NOT EXISTS idx_boards_embedId ON boards(embedId)`,
      `CREATE INDEX IF NOT EXISTS idx_boards_status ON boards(status)`,
      `CREATE INDEX IF NOT EXISTS idx_boards_type ON boards(type)`,
      `CREATE INDEX IF NOT EXISTS idx_areas_userId ON areas(userId)`,
      `CREATE INDEX IF NOT EXISTS idx_users_embedKey ON users(embedKey)`,
    ]);
    console.log('   ✓ Schema ready\n');

    // 2. Users migrieren
    console.log('2️⃣  Migriere Nutzer...');
    const usersResult = await neonClient.query('SELECT * FROM users');
    const users = usersResult.rows;
    console.log(`   Gefunden: ${users.length} Nutzer`);

    let userCount = 0;
    for (const u of users) {
      try {
        const embedKey = u.embed_key || u.embedKey || `ek_${u.id}`;
        await turso.execute({
          sql: `INSERT OR IGNORE INTO users (id, email, password, name, plan, role, company, embedKey, status, notes, websiteUrl, brandColors, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            u.id,
            u.email,
            u.password,
            u.name || '',
            u.plan || 'free',
            u.role || 'user',
            u.company || '',
            embedKey,
            u.status || 'active',
            u.notes || '',
            u.website_url || u.websiteUrl || '',
            JSON.stringify(u.brand_colors || u.brandColors || {}),
            u.created_at || u.createdAt || new Date().toISOString(),
            u.updated_at || u.updatedAt || new Date().toISOString(),
          ],
        });
        userCount++;
      } catch (err) {
        console.error(`   ⚠️  Fehler bei ${u.email}: ${err.message}`);
      }
    }
    console.log(`   ✓ ${userCount}/${users.length} Nutzer migriert\n`);

    // 3. Boards migrieren
    console.log('3️⃣  Migriere Boards...');
    const boardsResult = await neonClient.query('SELECT * FROM boards');
    const boards = boardsResult.rows;
    console.log(`   Gefunden: ${boards.length} Boards`);

    let boardCount = 0;
    for (const b of boards) {
      try {
        const {
          id, embed_id, embedId,
          user_id, userId,
          type, status,
          board_name, boardName,
          views, clicks,
          created_at, createdAt,
          updated_at, updatedAt,
          ...rest
        } = b;

        // Alle anderen Felder (title, content, etc.) ins JSON data-Feld
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
        boardCount++;
      } catch (err) {
        console.error(`   ⚠️  Fehler bei Board ${b.id}: ${err.message}`);
      }
    }
    console.log(`   ✓ ${boardCount}/${boards.length} Boards migriert\n`);

    // 4. Areas migrieren
    console.log('4️⃣  Migriere Website-Bereiche...');
    try {
      const areasResult = await neonClient.query('SELECT * FROM areas');
      const areas = areasResult.rows;
      console.log(`   Gefunden: ${areas.length} Bereiche`);

      let areaCount = 0;
      for (const a of areas) {
        try {
          await turso.execute({
            sql: 'INSERT OR IGNORE INTO areas (id, userId, name, description) VALUES (?, ?, ?, ?)',
            args: [
              a.id,
              a.user_id || a.userId,
              a.name,
              a.description || '',
            ],
          });
          areaCount++;
        } catch (err) {
          console.error(`   ⚠️  Fehler bei Bereich ${a.id}: ${err.message}`);
        }
      }
      console.log(`   ✓ ${areaCount}/${areas.length} Bereiche migriert\n`);
    } catch (err) {
      console.log(`   ℹ️  Areas-Tabelle nicht vorhanden (ignoriert)\n`);
    }

    // Abschluss
    console.log('✅ Migration erfolgreich!\n');
    console.log('📝 Nächste Schritte:');
    console.log('   1. Deploy den neuen Backend auf Railway');
    console.log('   2. Setze TURSO_DATABASE_URL und TURSO_AUTH_TOKEN in Railway');
    console.log('   3. Ändere js/config.js mit der neuen Backend-URL');
    console.log('   4. Teste die App\n');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ Migration fehlgeschlagen:', err);
    process.exit(1);
  } finally {
    await neonClient.end();
  }
}

migrate();
