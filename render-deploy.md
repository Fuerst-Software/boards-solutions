# Deploy zu Render.com (KOSTENLOS)

## 🚀 EINFACH: Nur 1 Klick!

Klick diesen Link und Render deployt automatisch:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Fuerst-Software/boards-solutions)

---

## Wenn der Button nicht funktioniert, manuell:

1. Öffne: **https://render.com/register**
2. Login mit GitHub
3. Geh zu: **https://dashboard.render.com**
4. Klick **"New +"** → **"Web Service"**
5. Wähle: `https://github.com/Fuerst-Software/boards-solutions`
6. Name: `boards-solutions`
7. Root: `backend`
8. Runtime: `Node`
9. Build Command: `npm install`
10. Start Command: `npm start`
11. Environment Variables setzen:
    ```
    TURSO_DATABASE_URL = libsql://boardssolutions-boardssolutions.aws-us-east-1.turso.io
    TURSO_AUTH_TOKEN = eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODIwODY5MTcsImlkIjoiMDE5ZWVjYTUtYzkwMS03YTYyLWE1YWQtN2JjZTA2ZTA3MjM1IiwicmlkIjoiYzkwNDAwOGEtMjkwZi00YjNlLWE0NzYtZjBhMDU1NDAyM2QxIn0.1NQxUIOBY859TDmA5EkTsWwaEvKfjeRXJZ1aMfB5_-yAzJ7jWZ2o_UlSKyrRMcnYzOgVxNmYlgwz7g7VOJTwAQ
    JWT_SECRET = change-me-to-random-string
    NODE_ENV = production
    ```
12. Klick **"Create Web Service"** ⚡

Render deployt automatisch in 2-3 Min! ✅

---

## Nach Deploy:

1. Kopiere die neue URL (sieht aus wie: `https://boards-solutions-xxxx.onrender.com`)
2. Öffne GitHub: `js/config.js`
3. Edit die neue URL rein
4. Commit & Push

FERTIG! 🎉
