# boards.solutions Backend

Express + Turso (SQLite) API für boards.solutions.

**9 GB kostenlos** — 18x mehr als Neon's 0.5 GB Free Tier!

## Quick Start (Lokal)

```bash
npm install
# Mit lokaler SQLite-Datei (für Entwicklung)
npm run dev
# API läuft unter http://localhost:3000/api

# oder mit Turso
TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." npm run dev
```

## Migration: Neon → Turso

Damit der Nutzer nach dem Wechsel keinen Datenverlust hat.

### 1. Turso-Datenbank erstellen

```bash
# Kostenlos auf https://turso.tech
turso db create boards-solutions

# Anmeldedaten holen
turso db show boards-solutions --url
turso db tokens create boards-solutions
```

### 2. Neon-Daten migrieren

```bash
# pg-Modul installieren (nur für Migration nötig)
npm install pg

# Neon-Connection String von https://console.neon.tech kopieren
export NEON_DATABASE_URL="postgresql://user:pass@ep-xxx.region.neon.tech/db?sslmode=require"
export TURSO_DATABASE_URL="libsql://your-db-name-org.turso.io"
export TURSO_AUTH_TOKEN="your-token"

# Migriere ALLE Daten
node migrate-from-neon.js
```

✅ Alle Nutzer, Boards, Areas und Einstellungen sind jetzt in Turso!

## Deployment auf Railway

1. **GitHub-Repo mit Backend-Code pushen** (bereits gemacht ✓)

2. **Neues Railway-Projekt erstellen:**
   - https://railway.app/new
   - GitHub-Repo wählen
   - `backend/` als Root-Directory setzen

3. **Umgebungsvariablen setzen (Railway Dashboard):**
   ```
   TURSO_DATABASE_URL=libsql://your-db-name-org.turso.io
   TURSO_AUTH_TOKEN=your-auth-token
   JWT_SECRET=your-secret-key-change-me
   ```

4. **Railway deployed automatisch** und weist eine URL zu (z.B. `https://app-prod-xxx.railway.app`)

5. **Frontend aktualisieren:**
   - Öffne `js/config.js` im Hauptverzeichnis
   - Ändere `API_URL` zu deiner neuen Railway-URL
   - Pushe den Commit

## API-Endpoints

Alle 19 Endpoints unterstützen die gleiche Schnittstelle wie das alte Neon-Backend:

### Auth
- `POST /api/auth/login` — Einloggen
- `GET /api/auth/me` — Aktuellen Nutzer abrufen
- `PUT /api/auth/profile` — Profil aktualisieren
- `POST /api/auth/change-password` — Passwort ändern

### Boards
- `GET /api/boards?type=&status=&q=` — Alle Boards abrufen (mit Filtern)
- `POST /api/boards` — Board erstellen
- `GET /api/boards/:id` — Einzelnes Board abrufen
- `PUT /api/boards/:id` — Board aktualisieren
- `DELETE /api/boards/:id` — Board löschen
- `PATCH /api/boards/:id/status` — Publish-Status ändern
- `POST /api/boards/:id/duplicate` — Board duplizieren

### Areas (Website-Bereiche)
- `GET /api/areas` — Alle Bereiche abrufen
- `POST /api/areas` — Bereich erstellen
- `PUT /api/areas/:id` — Bereich aktualisieren
- `DELETE /api/areas/:id` — Bereich löschen

### Embed (Öffentlich)
- `GET /api/embed/board/:embedId` — Einzelnes Board (öffentlich, kein Auth)
- `GET /api/embed/channel/:embedKey` — Alle Boards eines Nutzers

### Settings
- `GET /api/settings/brand` — Brand-Farben abrufen
- `PUT /api/settings/brand` — Brand-Farben speichern
- `POST /api/settings/analyze-colors` — Website-Farben analysieren

### Admin
- `GET /api/admin/stats` — Statistiken
- `GET /api/admin/customers` — Alle Kunden
- `POST /api/admin/customers` — Kunde erstellen
- `PUT /api/admin/customers/:id` — Kunde aktualisieren
- `DELETE /api/admin/customers/:id` — Kunde löschen

## Datenbank-Schema

### users
```
id (PK)           - Eindeutige Nutzer-ID
email (unique)    - E-Mail-Adresse
password          - Gehashtes Passwort (bcrypt)
name              - Anzeigename
plan              - 'free' | 'pro' | 'business'
role              - 'user' | 'admin'
company           - Firmennname
embedKey (unique) - Für Embed-URLs (z.B. für channel.js)
status            - 'active' | 'inactive' | 'suspended'
brandColors       - JSON: {primary, secondary, background, ...}
websiteUrl        - URL des Nutzers (für Farbanalyse)
createdAt         - ISO-Zeitstempel
updatedAt         - ISO-Zeitstempel
```

### boards
```
id (PK)           - Eindeutige Board-ID
embedId (unique)  - Für Embed-URLs (z.B. für embed.js)
userId (FK)       - Gehört zu diesem Nutzer
type              - 'blog' | 'affiliate' | 'review' | 'faq' | ...
status            - 'draft' | 'published'
boardName         - Interner Name
data              - JSON: alle anderen Felder (title, content, etc.)
views             - Anzahl Aufrufe
clicks            - Anzahl Klicks
createdAt         - ISO-Zeitstempel
updatedAt         - ISO-Zeitstempel
```

### areas
```
id (PK)           - Eindeutige Bereichs-ID
userId (FK)       - Gehört zu diesem Nutzer
name              - Name (z.B. "Homepage")
description       - Beschreibung
```

## Lokale Entwicklung

```bash
npm run dev
# Server läuft auf http://localhost:3000
# Nutzt `local.db` (SQLite-Datei)

# Admin-User wird automatisch erstellt:
# Email: admin@boards.solutions
# Password: Admin1234
```

## Troubleshooting

**"pg Modul nicht gefunden"**
```bash
npm install pg
# Nur für migrate-from-neon.js nötig, nicht für den Server selbst
```

**"TURSO_DATABASE_URL fehlt"**
- Lokal: Ignoriert (nutzt local.db)
- Railway: In Environment Variables setzen

**"Authentifizierung fehlgeschlagen"**
- JWT_SECRET auf beiden Seiten (Frontend) gleich?
- Token abgelaufen? (7 Tage Gültigkeit)

## Performance

- **Turso**: Up to 100k+ requests/day im Free Tier
- **SQLite**: Schnell für einzelne Nutzer, gut skalierbar
- **Caching**: Frontend cached lokal mit localStorage

## Nächste Schritte

1. ✅ Backend gebaut und getestet
2. ⬜ Neon → Turso Daten migrieren
3. ⬜ Railway deployen
4. ⬜ `js/config.js` mit neuer URL aktualisieren
5. ⬜ Testen
