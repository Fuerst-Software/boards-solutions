# 🚀 Neon → Turso Migration Guide

**Speicher:** Neon 0.5GB (VOLL) → Turso 9GB (18x mehr!)

**Kein Datenverlust:** Alle Nutzer, Boards, Areas, Einstellungen werden migriert.

---

## ✅ CHECKLISTE

### Phase 1: Vorbereitung (5 Minuten)

- [ ] Turso-Account erstellen: https://turso.tech (kostenlos)
- [ ] Turso CLI installieren:
  ```bash
  curl -sSfL https://get.tur.so/install.sh | bash
  ```
- [ ] Bei Turso anmelden: `turso auth login`

### Phase 2: Turso-Datenbank erstellen (2 Minuten)

```bash
# Neue DB erstellen
turso db create boards-solutions

# Anmeldedaten kopieren
TURSO_URL=$(turso db show boards-solutions --url)
echo "TURSO_DATABASE_URL=$TURSO_URL"

TURSO_TOKEN=$(turso db tokens create boards-solutions)
echo "TURSO_AUTH_TOKEN=$TURSO_TOKEN"
```

**Speichere diese Werte!** (Du brauchst sie für die Migration und Railway.)

### Phase 3: Daten migrieren (5-10 Minuten)

```bash
cd backend

# pg-Modul nur für Migration nötig (optional)
npm install pg

# Neon-Connection von hier kopieren:
# https://console.neon.tech/app/projects → Database → Connection string

export NEON_DATABASE_URL="postgresql://user:pass@ep-xxx.region.neon.tech/db?sslmode=require"
export TURSO_DATABASE_URL="libsql://your-db-name-org.turso.io"
export TURSO_AUTH_TOKEN="your-token-from-above"

# ALLE DATEN JETZT MIGRIEREN
node migrate-from-neon.js
```

✅ **Alle Nutzer, Boards, Areas sind jetzt in Turso!**

### Phase 4: Neuen Backend auf Railway deployen (10-15 Minuten)

1. **GitHub-Branch mergen:**
   ```bash
   git push  # Stelle sicher, dass alles gepusht ist
   ```
   Die `claude/neon-storage-alternative-u30cw3` Branch hat:
   - ✅ Express + Turso Backend
   - ✅ Zentrale API-Konfiguration
   - ✅ Migrations-Script

2. **Railway Projekt erstellen:**
   - https://railway.app/new
   - GitHub-Repo wählen: `Fuerst-Software/boards-solutions`
   - `backend/` als Root Directory setzen

3. **Environment Variables in Railway:**
   ```
   TURSO_DATABASE_URL=libsql://your-db-name-org.turso.io
   TURSO_AUTH_TOKEN=your-token
   JWT_SECRET=your-secret-key (ändere mich!)
   ```

4. **Railway deployed automatisch** → neue URL wie `https://app-prod-abc123.railway.app`

- [ ] Note: Die Railway-URL

### Phase 5: Frontend aktualisieren (2 Minuten)

Die API-URL ist zentral in einer Datei:

```javascript
// js/config.js
export const API_URL = 'https://your-new-railway-url.railway.app/api';
```

**Ändere:** `https://web-production-83480.up.railway.app/api` 
**Zu:** Deine neue Railway-URL

```bash
# Beispiel:
# https://app-prod-abc123.railway.app/api
```

Dann pushen:
```bash
git add js/config.js
git commit -m "Update API URL to new Turso backend"
git push
```

### Phase 6: Live-Test (5 Minuten)

- [ ] Öffne https://boards.solutions.com
- [ ] Versuche dich einzuloggen (Demo: `admin@boards.solutions` / `Admin1234`)
- [ ] Erstelle ein neues Board
- [ ] Veröffentliche ein Board
- [ ] Teste Embed-Script auf einer externen Seite

---

## 🔧 Troubleshooting

### "NEON_DATABASE_URL nicht gesetzt"
```bash
# Neon Connection String holen:
# https://console.neon.tech/app/projects → Project → Connection string
# Format: postgresql://user:pass@ep-xxx.neon.tech/db?sslmode=require
```

### "Migration fehlgeschlagen: pg Modul nicht gefunden"
```bash
npm install pg
# Nur für migrate-from-neon.js nötig
```

### "API antwortet mit 401 Unauthorized"
- JWT_SECRET in Railway und boards-solutions haben keinen Wechsel-Support
- Nutzer müssen sich neu anmelden (Tokens sind an altes Backend gebunden)
- Das ist normal für einen Backend-Wechsel

### "Alte Daten sind weg!"
- Führe das Migration-Script nochmal aus
- Stelle sicher, dass NEON_DATABASE_URL korrekt ist
- Prüfe in Turso: `turso shell boards-solutions` → `SELECT COUNT(*) FROM users;`

---

## 📊 Datenbank-Vergleich

| Feature | Neon | Turso |
|---------|------|-------|
| **Speicher (kostenlos)** | 0.5 GB ❌ | **9 GB** ✅ |
| **Datenbank-Engine** | PostgreSQL | SQLite (via LibSQL) |
| **Replikation** | ✅ | ✅ (Pro-Tier) |
| **API** | SQL-basiert | REST + SQL |
| **Kosten (free)** | $0 (0.5GB) | $0 (9GB) |
| **Preis (Pro)** | $20/mo | $29/mo |

---

## 🎯 Was wird migriert?

| Tabelle | Inhalt | Status |
|---------|--------|--------|
| **users** | Alle Nutzer-Accounts mit Passwörtern | ✅ Automatisch |
| **boards** | Alle Boards + Inhalte (Blogs, Reviews, FAQs, etc.) | ✅ Automatisch |
| **areas** | Website-Bereiche | ✅ Automatisch |
| **settings** | Brand-Farben, Website-URLs | ✅ In user.brandColors |

**Keine manuellen Daten-Arbeiten nötig!**

---

## 📝 Nach der Migration

### Alte Neon-Datenbank
- Du kannst sie behalten (read-only Backup)
- Oder löschen um Kosten zu sparen

### Monitoring
```bash
# Prüfe Turso-Usage
turso db show boards-solutions --stats

# Oder über Dashboard: https://console.turso.tech
```

### Rollback (Notfall)
1. Ändere `js/config.js` zurück zur alten URL
2. Pushe
3. Frontend nutzt wieder altes Backend

---

## 🚀 Ready?

Folge dieser Checkliste Schritt für Schritt:

1. ⬜ Phase 1: Vorbereitung
2. ⬜ Phase 2: Turso-DB erstellen
3. ⬜ Phase 3: Daten migrieren
4. ⬜ Phase 4: Backend deployen
5. ⬜ Phase 5: URL aktualisieren
6. ⬜ Phase 6: Testen

**Zeitaufwand:** ~30-45 Minuten

Fragen? Siehe `backend/README.md` für technische Details.
