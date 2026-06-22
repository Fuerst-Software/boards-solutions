#!/usr/bin/env node
/**
 * BOARDS-SOLUTIONS: MIGRATION SCRIPT
 *
 * So geht's:
 * 1. Öffne diese Datei auf GitHub im Web-Editor
 * 2. Ersetze die Werte unter "CONFIG" mit deinen Credentials
 * 3. Speichere die Datei
 * 4. Öffne GitHub Codespaces oder führe lokal aus
 * 5. Führe aus: node RUN-MIGRATION.js
 */

// ═══════════════════════════════════════════════════════════════════
// CONFIG: Trage deine Credentials hier ein!
// ═══════════════════════════════════════════════════════════════════

const CONFIG = {
  // Von: https://console.neon.tech → Database → Connection String
  NEON_DATABASE_URL: 'postgresql://neondb_owner:npg_w6JAOY8dTyeu@ep-fancy-unit-al1rh2ae-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',

  // Von: turso db show boards-solutions --url
  TURSO_DATABASE_URL: 'libsql://boardssolutions-boardssolutions.aws-us-east-1.turso.io',

  // Von: turso db tokens create boards-solutions
  TURSO_AUTH_TOKEN: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODIwODY5MTcsImlkIjoiMDE5ZWVjYTUtYzkwMS03YTYyLWE1YWQtN2JjZTA2ZTA3MjM1IiwicmlkIjoiYzkwNDAwOGEtMjkwZi00YjNlLWE0NzYtZjBhMDU1NDAyM2QxIn0.1NQxUIOBY859TDmA5EkTsWwaEvKfjeRXJZ1aMfB5_-yAzJ7jWZ2o_UlSKyrRMcnYzOgVxNmYlgwz7g7VOJTwAQ',
};

// ═══════════════════════════════════════════════════════════════════
// START MIGRATION
// ═══════════════════════════════════════════════════════════════════

async function main() {
  console.log('🚀 Starting migration Neon → Turso...\n');

  // Prüfe ob Backend-Directory existiert
  if (!process.env.npm_package_name) {
    console.log('ℹ️  Prüfe ob wir im backend-Directory sind...');
    // Versuche den migrate-from-neon.js zu laden
  }

  // Importiere das Migrations-Skript von backend/
  try {
    const path = require('path');
    const backendPath = path.join(__dirname, 'backend');

    // Setze Environment-Variablen
    process.env.NEON_DATABASE_URL = CONFIG.NEON_DATABASE_URL;
    process.env.TURSO_DATABASE_URL = CONFIG.TURSO_DATABASE_URL;
    process.env.TURSO_AUTH_TOKEN = CONFIG.TURSO_AUTH_TOKEN;

    // Führe die echte Migration aus
    console.log('✅ Environment variables set');
    console.log('📁 Running: backend/migrate-from-neon.js\n');

    // Wechsle zum Backend-Directory
    process.chdir(backendPath);

    // Lade das Migrations-Skript
    await import('./backend/migrate-from-neon.js');

  } catch (err) {
    console.error('❌ Fehler:', err.message);

    // Fallback: Gib Instruktionen
    console.log('\n═══════════════════════════════════════════════');
    console.log('💡 Wenn das nicht funktioniert, führe das aus:');
    console.log('═══════════════════════════════════════════════\n');

    console.log('export NEON_DATABASE_URL="' + CONFIG.NEON_DATABASE_URL + '"');
    console.log('export TURSO_DATABASE_URL="' + CONFIG.TURSO_DATABASE_URL + '"');
    console.log('export TURSO_AUTH_TOKEN="' + CONFIG.TURSO_AUTH_TOKEN + '"\n');
    console.log('npm --prefix backend install pg');
    console.log('node backend/migrate-from-neon.js\n');

    process.exit(1);
  }
}

main().catch(err => {
  console.error('Migration fehlgeschlagen:', err);
  process.exit(1);
});
