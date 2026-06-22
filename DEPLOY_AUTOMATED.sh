#!/bin/bash

###############################################################################
# BOARDS-SOLUTIONS: AUTOMATED DEPLOYMENT (Neon → Turso)
#
# Dieses Skript führt alle Deployment-Schritte automatisch durch:
# 1. Turso Setup (erstellt Database)
# 2. Daten-Migration (Neon → Turso)
# 3. Railway Deployment
# 4. Frontend Update
#
# Voraussetzungen:
# - turso CLI: https://docs.turso.tech/cli/installation
# - Railway CLI: npm install -g @railway/cli
# - Git Zugriff auf Fuerst-Software/boards-solutions
# - Neon Database Connection String
#
# Verwendung:
#   chmod +x DEPLOY_AUTOMATED.sh
#   NEON_DATABASE_URL="postgresql://..." ./DEPLOY_AUTOMATED.sh
#
###############################################################################

set -e  # Exit on error

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Ausgabe-Funktionen
log_info() { echo -e "${GREEN}✅${NC} $1"; }
log_warn() { echo -e "${YELLOW}⚠️ ${NC} $1"; }
log_error() { echo -e "${RED}❌${NC} $1"; exit 1; }

# Umgebungsvariablen checken
if [ -z "$NEON_DATABASE_URL" ]; then
  log_error "NEON_DATABASE_URL nicht gesetzt. Beispiel:\n   export NEON_DATABASE_URL='postgresql://user:pass@...'"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║   BOARDS-SOLUTIONS DEPLOYMENT: Neon → Turso                ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# ============================================================================
# PHASE 1: Turso Setup
# ============================================================================
log_info "Phase 1: Turso Setup..."

# Prüfe ob turso CLI installiert ist
if ! command -v turso &> /dev/null; then
  log_error "turso CLI nicht gefunden. Installiere es:\n   https://docs.turso.tech/cli/installation"
fi

# Prüfe ob eingeloggt
if ! turso auth info &> /dev/null; then
  log_warn "Nicht bei Turso eingeloggt. Starten Login..."
  turso auth login
fi

# Database erstellen
log_info "Erstelle Turso Database 'boards-solutions'..."
if turso db create boards-solutions 2>/dev/null || turso db show boards-solutions &>/dev/null; then
  log_info "Database existiert bereits oder wurde erstellt"
else
  log_error "Konnte Turso Database nicht erstellen"
fi

# Credentials auslesen
log_info "Lese Turso-Credentials aus..."
TURSO_URL=$(turso db show boards-solutions --url)
TURSO_TOKEN=$(turso db tokens create boards-solutions)

if [ -z "$TURSO_URL" ] || [ -z "$TURSO_TOKEN" ]; then
  log_error "Konnte Turso-Credentials nicht auslesen"
fi

log_info "Turso-Database erstellt:"
echo "   URL: $TURSO_URL"
echo "   Token: ${TURSO_TOKEN:0:20}..."

# ============================================================================
# PHASE 2: Daten-Migration
# ============================================================================
log_info "Phase 2: Migriere Daten (Neon → Turso)..."

cd backend

# pg-Modul installieren (falls nötig)
if ! npm list pg &>/dev/null; then
  log_info "Installiere pg-Modul für Migration..."
  npm install pg --save-optional --quiet
fi

# Migration ausführen
log_info "Starten Datenmigration..."
export TURSO_DATABASE_URL="$TURSO_URL"
export TURSO_AUTH_TOKEN="$TURSO_TOKEN"

node migrate-from-neon.js

if [ $? -eq 0 ]; then
  log_info "Datenmigration erfolgreich!"
else
  log_error "Datenmigration fehlgeschlagen"
fi

# Daten-Integrität prüfen
log_info "Prüfe Datenmigration..."
NEON_USERS=$(PGPASSWORD="${NEON_DATABASE_URL##*:}" psql "${NEON_DATABASE_URL}" -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")
TURSO_USERS=$(turso shell boards-solutions "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")

echo "   Neon Users: $NEON_USERS"
echo "   Turso Users: $TURSO_USERS"

# ============================================================================
# PHASE 3: Railway Deployment
# ============================================================================
log_info "Phase 3: Railway Deployment..."

# Prüfe ob railway CLI installiert ist
if ! command -v railway &> /dev/null; then
  log_warn "railway CLI nicht gefunden. Installiere..."
  npm install -g @railway/cli --silent
fi

# Prüfe ob eingeloggt
if ! railway whoami &> /dev/null; then
  log_warn "Nicht bei Railway eingeloggt. Starten Login..."
  railway login
fi

# Starte Deployment
log_info "Deploye Backend zu Railway..."
railway up --service backend

if [ $? -eq 0 ]; then
  log_info "Railway Deployment erfolgreich!"
else
  log_warn "Railway Deployment möglicherweise nicht vollständig (siehe oben)"
fi

# Bekomme neue Railway URL
log_info "Auslesen neue Railway URL..."
RAILWAY_URL=$(railway service list --service backend 2>/dev/null | grep -oE 'https://[^/]+' | head -1)

if [ -z "$RAILWAY_URL" ]; then
  log_warn "Konnte Railway URL nicht automatisch auslesen"
  log_warn "Manuelle Schritte:"
  log_warn "1. Gehe zu https://railway.app"
  log_warn "2. Finde dein boards-solutions Projekt"
  log_warn "3. Kopiere die URL vom 'board' Service"
  log_warn "4. Setze RAILWAY_URL manuell und führe dieses Skript erneut aus"
  read -p "Gib die Railway URL ein (z.B. https://...railway.app): " RAILWAY_URL
fi

if [ -z "$RAILWAY_URL" ]; then
  log_error "Railway URL erforderlich"
fi

log_info "Railway URL: $RAILWAY_URL"

# Setze Environment Variables in Railway
log_info "Setze Umgebungsvariablen in Railway..."
railway variables set \
  TURSO_DATABASE_URL="$TURSO_URL" \
  TURSO_AUTH_TOKEN="$TURSO_TOKEN" \
  JWT_SECRET="$(openssl rand -base64 32)" \
  NODE_ENV="production"

if [ $? -eq 0 ]; then
  log_info "Umgebungsvariablen gesetzt"
else
  log_warn "Umgebungsvariablen möglicherweise nicht alle gesetzt"
fi

# Triggere Redeploy mit neuen Variables
log_info "Trigger Redeploy mit neuen Umgebungsvariablen..."
railway up --service backend

# ============================================================================
# PHASE 4: Frontend Update
# ============================================================================
log_info "Phase 4: Update Frontend API-URL..."

cd ..

# Update config.js
BOARDS_API_URL="${RAILWAY_URL}/api"
sed -i.bak "s|export const API_URL = .*|export const API_URL = '${BOARDS_API_URL}';|" js/config.js

log_info "Updated js/config.js"
echo "   Neue API URL: $BOARDS_API_URL"

# ============================================================================
# PHASE 5: Tests
# ============================================================================
log_info "Phase 5: Ausführen Tests..."

cd backend

# Starte Server im Hintergrund
log_info "Starten Backend-Server lokal..."
npm start &
SERVER_PID=$!

# Warte bis Server ready ist
sleep 3

# Führe Tests aus
npm run test

TEST_RESULT=$?

# Kill Server
kill $SERVER_PID 2>/dev/null || true

if [ $TEST_RESULT -eq 0 ]; then
  log_info "Alle Tests bestanden!"
else
  log_warn "Einige Tests fehlgeschlagen (siehe oben)"
fi

# ============================================================================
# PHASE 6: Git Commit & Push
# ============================================================================
log_info "Phase 6: Git Commit & Push..."

cd ..

git add js/config.js
git commit -m "Update: API_URL auf neue Turso/Railway Backend" || true
git push origin claude/neon-storage-alternative-u30cw3

if [ $? -eq 0 ]; then
  log_info "Änderungen gepusht"
fi

# ============================================================================
# Abschluss
# ============================================================================
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                   🎉 DEPLOYMENT ABGESCHLOSSEN 🎉           ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
log_info "Neue Backend-URL: $RAILWAY_URL"
log_info "API-URL: $BOARDS_API_URL"
log_info "Frontend URL: https://boards.solutions.com"
echo ""
echo "Nächste Schritte:"
echo "  1. Prüfe https://boards.solutions.com im Browser"
echo "  2. Login mit Demo-User (admin@boards.solutions)"
echo "  3. Teste Board-Operationen"
echo "  4. Prüfe Turso-Statistiken: turso db show boards-solutions --stats"
echo ""
log_info "Fertig! 🚀"
