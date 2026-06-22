# 🚀 1-Klick Deployment

Klick diesen Button und ALLES läuft automatisch:

[![Deploy to Railway](https://railway.app/button.svg)](https://railway.app/new)

**Anleitung (nur Klicks, keine Text!):**

1. Klick den Button oben
2. Wähle: **GitHub** → **Fuerst-Software/boards-solutions**
3. Wähle Root: **backend/**
4. Klick **Deploy**
5. Railway gibt neue URL
6. Setze diese Env-Variablen in Railway:
   ```
   TURSO_DATABASE_URL=libsql://boardssolutions-boardssolutions.aws-us-east-1.turso.io
   TURSO_AUTH_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODIwODY5MTcsImlkIjoiMDE5ZWVjYTUtYzkwMS03YTYyLWE1YWQtN2JjZTA2ZTA3MjM1IiwicmlkIjoiYzkwNDAwOGEtMjkwZi00YjNlLWE0NzYtZjBhMDU1NDAyM2QxIn0.1NQxUIOBY859TDmA5EkTsWwaEvKfjeRXJZ1aMfB5_-yAzJ7jWZ2o_UlSKyrRMcnYzOgVxNmYlgwz7g7VOJTwAQ
   JWT_SECRET=your-super-secret-key-change-me
   NODE_ENV=production
   ```

✅ Fertig! Backend läuft mit Turso!

---

**Für User-Daten Migration (Neon → Turso):**

Nutze GitHub Actions - ganz einfach:
- https://github.com/Fuerst-Software/boards-solutions/actions
- Wähle Branch: `claude/neon-storage-alternative-u30cw3`
- Klick auf **"Migrate Neon to Turso"** Workflow
- Klick **"Run workflow"**
- Gib 3 Werte ein (copy-paste aus vorher), klick **"Run"**
- Fertig! ✅
