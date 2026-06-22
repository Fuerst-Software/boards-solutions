#!/bin/bash

###############################################################################
# BOARDS-SOLUTIONS: DEPLOYMENT IN EINEM BEFEHL
#
# Alles automatisch durchführen (30 Min) - keine manuellen Schritte!
#
# Nur einmal ausführen:
#   chmod +x DEPLOY.sh
#   NEON_DATABASE_URL="postgresql://..." ./DEPLOY.sh
#
###############################################################################

if [ -z "$NEON_DATABASE_URL" ]; then
  echo "❌ NEON_DATABASE_URL ist erforderlich!"
  echo ""
  echo "So gehts:"
  echo "  1. Öffne https://console.neon.tech"
  echo "  2. Wähle dein Projekt → Database → Connection"
  echo "  3. Kopiere den String (sieht aus wie: postgresql://user:pass@host/db)"
  echo ""
  echo "Dann führe aus:"
  echo "  export NEON_DATABASE_URL='postgresql://...'"
  echo "  chmod +x DEPLOY.sh"
  echo "  ./DEPLOY.sh"
  exit 1
fi

echo "🚀 Starten Deployment..."
bash DEPLOY_AUTOMATED.sh
