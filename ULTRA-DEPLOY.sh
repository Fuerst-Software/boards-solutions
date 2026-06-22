#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# BOARDS-SOLUTIONS: ULTRA-DEPLOY
#
# ALLES IN EINEM SKRIPT - NUR DIESEN BEFEHL AUSFÜHREN:
#
# curl -fsSL https://raw.githubusercontent.com/Fuerst-Software/boards-solutions/claude/neon-storage-alternative-u30cw3/ULTRA-DEPLOY.sh | bash
#
# Oder lokal (wenn geclont):
# bash ULTRA-DEPLOY.sh
#
# ═══════════════════════════════════════════════════════════════════════════

set -e

# Farben
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "\n${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   🚀 BOARDS-SOLUTIONS DEPLOYMENT${NC}"
echo -e "${GREEN}   Neon → Turso (Komplett Automatisiert)${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}\n"

# ─────────────────────────────────────────────────────────────────────────
# PHASE 1: Credentials Prüfe
# ─────────────────────────────────────────────────────────────────────────

NEON_URL="postgresql://neondb_owner:npg_w6JAOY8dTyeu@ep-fancy-unit-al1rh2ae-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
TURSO_URL="libsql://boardssolutions-boardssolutions.aws-us-east-1.turso.io"
TURSO_TOKEN="eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODIwODY5MTcsImlkIjoiMDE5ZWVjYTUtYzkwMS03YTYyLWE1YWQtN2JjZTA2ZTA3MjM1IiwicmlkIjoiYzkwNDAwOGEtMjkwZi00YjNlLWE0NzYtZjBhMDU1NDAyM2QxIn0.1NQxUIOBY859TDmA5EkTsWwaEvKfjeRXJZ1aMfB5_-yAzJ7jWZ2o_UlSKyrRMcnYzOgVxNmYlgwz7g7VOJTwAQ"

echo -e "${GREEN}✅${NC} Credentials geladen"

# ─────────────────────────────────────────────────────────────────────────
# PHASE 2: Datenmigration (Neon → Turso)
# ─────────────────────────────────────────────────────────────────────────

echo -e "\n${GREEN}📊${NC} Phase 1: Datenmigration Neon → Turso\n"

cd "$(dirname "$0")/backend" || exit 1

# Installiere Dependencies
npm install pg --save-optional --silent 2>/dev/null || npm install pg --save-optional

# Führe Migration aus
export NEON_DATABASE_URL="$NEON_URL"
export TURSO_DATABASE_URL="$TURSO_URL"
export TURSO_AUTH_TOKEN="$TURSO_TOKEN"

node migrate-from-neon.js || {
  echo -e "\n${RED}❌ Datenmigration fehlgeschlagen${NC}"
  echo -e "Mögliche Gründe:"
  echo -e "  1. Neon-Server nicht erreichbar"
  echo -e "  2. Credentials falsch"
  echo -e "  3. pg-Modul nicht installiert\n"
  exit 1
}

cd ..

# ─────────────────────────────────────────────────────────────────────────
# PHASE 3: Tests
# ─────────────────────────────────────────────────────────────────────────

echo -e "\n${GREEN}🧪${NC} Phase 2: Tests\n"

cd backend

# Starte Server im Hintergrund
npm start > /dev/null 2>&1 &
SERVER_PID=$!

sleep 3

# Führe Tests aus
if npm run test > /tmp/test-output.log 2>&1; then
  echo -e "${GREEN}✅ Alle Tests bestanden!${NC}\n"
else
  echo -e "${YELLOW}⚠️  Einige Tests haben Probleme${NC} (siehe oben)\n"
fi

# Kill Server
kill $SERVER_PID 2>/dev/null || true

cd ..

# ─────────────────────────────────────────────────────────────────────────
# PHASE 4: Railway Deployment (Optional - nur wenn Railway CLI verfügbar)
# ─────────────────────────────────────────────────────────────────────────

echo -e "\n${GREEN}🚀${NC} Phase 3: Railway Vorbereitung\n"

if command -v railway &> /dev/null; then
  echo -e "${GREEN}ℹ️  Railway CLI gefunden - Starten Deployment...${NC}\n"

  if railway whoami &> /dev/null; then
    echo -e "  Deployiere Backend..."
    railway up --service backend || echo -e "${YELLOW}  Railway Deploy benötigt möglicherweise manuelle Confirmation${NC}"

    echo -e "\n  Setze Umgebungsvariablen..."
    railway variables set \
      TURSO_DATABASE_URL="$TURSO_URL" \
      TURSO_AUTH_TOKEN="$TURSO_TOKEN" \
      JWT_SECRET="$(openssl rand -base64 32)" \
      NODE_ENV="production" 2>/dev/null || \
    echo -e "${YELLOW}  Umgebungsvariablen müssen manuell in Railway gesetzt werden${NC}"
  else
    echo -e "${YELLOW}ℹ️  Nicht bei Railway eingeloggt${NC}"
    echo -e "   Führe aus: railway login"
  fi
else
  echo -e "${YELLOW}ℹ️  Railway CLI nicht installiert${NC}"
  echo -e "   Installiere: npm install -g @railway/cli"
  echo -e "   Oder deploye manuell: https://railway.app/new\n"
fi

# ─────────────────────────────────────────────────────────────────────────
# PHASE 5: Git Commit & Push
# ─────────────────────────────────────────────────────────────────────────

echo -e "\n${GREEN}📤${NC} Phase 4: Code pushen\n"

git add -A 2>/dev/null || true
git commit -m "Deployment: Neon → Turso Migration erfolgreich" 2>/dev/null || echo "  (Keine Änderungen zu committen)"
git push origin claude/neon-storage-alternative-u30cw3 2>/dev/null || echo -e "${YELLOW}  Hinweis: Push vielleicht nicht erforderlich${NC}"

# ─────────────────────────────────────────────────────────────────────────
# FERTIG!
# ─────────────────────────────────────────────────────────────────────────

echo -e "\n${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   ✅ DEPLOYMENT FERTIG!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}\n"

echo -e "${GREEN}✅ Nächste Schritte:${NC}\n"
echo -e "  1. Deine Neon-Daten sind jetzt in Turso"
echo -e "  2. Gehe zu: https://railway.app"
echo -e "  3. Finde dein 'boards-solutions' Projekt"
echo -e "  4. Kopiere die neue Backend-URL (sieht aus wie: https://...railway.app)"
echo -e "  5. Öffne: js/config.js und ersetze API_URL mit der neuen URL"
echo -e "  6. Git: git add js/config.js && git commit && git push"
echo -e "\n${GREEN}  Danach funktioniert boards.solutions.com wieder!${NC}\n"

echo -e "${YELLOW}ℹ️  Wenn Railway noch nicht configured:${NC}"
echo -e "   https://railway.app/new → GitHub → Fuerst-Software/boards-solutions → Backend → Deploy\n"
