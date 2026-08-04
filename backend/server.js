import express from 'express';
import cors from 'cors';
import compression from 'compression';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db, { initDb } from './db.js';

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'boards-solutions-secret-change-me';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Validate environment in production
if (NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'boards-solutions-secret-change-me') {
    console.warn('⚠️  WARNUNG: JWT_SECRET ist der Default! Bitte ändern für Production.');
  }
  if (!process.env.TURSO_DATABASE_URL) {
    console.error('❌ FEHLER: TURSO_DATABASE_URL muss in Production gesetzt sein');
    process.exit(1);
  }
}

app.use(compression());
app.use(cors());
app.use(express.json({
  limit: '10mb',
  strict: true,
}));

// Cache-Control header (API responses aren't cached by default)
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  next();
});

// JSON parse error handler
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Ungüliges JSON' });
  }
  next(err);
});

// ── Helpers ──────────────────────────────────────────────────────

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function now() {
  return new Date().toISOString();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(password) {
  return password && password.length >= 8;
}

function boardFromRow(row) {
  const parsed = JSON.parse(row.data || '{}');
  return {
    ...parsed,
    id: row.id,
    embedId: row.embedId,
    userId: row.userId,
    type: row.type,
    status: row.status,
    boardName: row.boardName,
    views: row.views,
    clicks: row.clicks,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function boardToRow(board) {
  const { id, embedId, userId, type, status, boardName, views, clicks, createdAt, updatedAt, ...rest } = board;
  return {
    id, embedId, userId,
    type: type || 'blog',
    status: status || 'draft',
    boardName: boardName || '',
    data: JSON.stringify(rest),
    views: views || 0,
    clicks: clicks || 0,
    createdAt: createdAt || now(),
    updatedAt: updatedAt || now(),
  };
}

// ── Auth Middleware ───────────────────────────────────────────────

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Nicht autorisiert' });
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token ungültig oder abgelaufen' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Nur Admins' });
  next();
}

// ═════════════════════════════════════════════════════════════════
//  Health
// ═════════════════════════════════════════════════════════════════

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', db: 'turso' });
});

// ═════════════════════════════════════════════════════════════════
//  Auth Routes
// ═════════════════════════════════════════════════════════════════

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'E-Mail und Passwort erforderlich' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Ungültige E-Mail-Adresse' });

  try {
    const result = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email.toLowerCase()] });
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'E-Mail oder Passwort falsch' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'E-Mail oder Passwort falsch' });

    if (user.status === 'suspended') return res.status(403).json({ error: 'Konto gesperrt' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        plan: user.plan,
        company: user.company,
        embedKey: user.embedKey,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.get('/api/auth/me', auth, async (req, res) => {
  try {
    const result = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [req.user.id] });
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'Nutzer nicht gefunden' });

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      plan: user.plan,
      company: user.company,
      embedKey: user.embedKey,
      websiteUrl: user.websiteUrl,
      brandColors: JSON.parse(user.brandColors || '{}'),
    });
  } catch {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.put('/api/auth/profile', auth, async (req, res) => {
  const { name, company } = req.body;
  if (!name) return res.status(400).json({ error: 'Name ist erforderlich' });

  try {
    const ts = now();
    await db.execute({
      sql: 'UPDATE users SET name = ?, company = ?, updatedAt = ? WHERE id = ?',
      args: [name, company || '', ts, req.user.id],
    });
    const result = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [req.user.id] });
    const user = result.rows[0];
    res.json({
      id: user.id, name: user.name, email: user.email,
      plan: user.plan, company: user.company, embedKey: user.embedKey,
    });
  } catch {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.post('/api/auth/change-password', auth, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) return res.status(400).json({ error: 'Altes und neues Passwort erforderlich' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'Neues Passwort muss mindestens 8 Zeichen haben' });

  try {
    const result = await db.execute({ sql: 'SELECT password FROM users WHERE id = ?', args: [req.user.id] });
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'Nutzer nicht gefunden' });

    const valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) return res.status(400).json({ error: 'Aktuelles Passwort ist falsch' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await db.execute({
      sql: 'UPDATE users SET password = ?, updatedAt = ? WHERE id = ?',
      args: [hashed, now(), req.user.id],
    });
    res.json({ message: 'Passwort geändert' });
  } catch {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ═════════════════════════════════════════════════════════════════
//  Boards Routes
// ═════════════════════════════════════════════════════════════════

app.get('/api/boards', auth, async (req, res) => {
  const { type, status, q } = req.query;

  // Validate enum values
  const validStatuses = ['draft', 'published'];
  const validTypes = ['blog', 'affiliate', 'review', 'faq', 'comparison', 'newsletter'];

  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Ungültiger Status' });
  }
  if (type && !validTypes.includes(type)) {
    return res.status(400).json({ error: 'Ungültiger Board-Typ' });
  }
  if (q && q.length > 100) {
    return res.status(400).json({ error: 'Suchtext zu lang (max 100 Zeichen)' });
  }

  try {
    let sql = 'SELECT * FROM boards WHERE userId = ?';
    const args = [req.user.id];

    if (type) { sql += ' AND type = ?'; args.push(type); }
    if (status) { sql += ' AND status = ?'; args.push(status); }
    if (q) {
      sql += ' AND (boardName LIKE ? OR data LIKE ?)';
      const like = `%${q}%`;
      args.push(like, like);
    }
    sql += ' ORDER BY updatedAt DESC';

    const result = await db.execute({ sql, args });
    res.json(result.rows.map(boardFromRow));
  } catch {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.post('/api/boards', auth, async (req, res) => {
  const { type, boardName } = req.body;

  // Validate
  const validTypes = ['blog', 'affiliate', 'review', 'faq', 'comparison', 'newsletter'];
  if (!type || !validTypes.includes(type)) {
    return res.status(400).json({ error: 'Gültiger Board-Typ erforderlich' });
  }

  try {
    const ts = now();
    const board = {
      ...req.body,
      id: req.body.id || uid(),
      embedId: req.body.embedId || uid(),
      userId: req.user.id,
      createdAt: req.body.createdAt || ts,
      updatedAt: ts,
      views: req.body.views || 0,
      clicks: req.body.clicks || 0,
    };
    const row = boardToRow(board);

    await db.execute({
      sql: `INSERT INTO boards (id, embedId, userId, type, status, boardName, data, views, clicks, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [row.id, row.embedId, row.userId, row.type, row.status, row.boardName, row.data, row.views, row.clicks, row.createdAt, row.updatedAt],
    });

    const result = await db.execute({ sql: 'SELECT * FROM boards WHERE id = ?', args: [row.id] });
    res.status(201).json(boardFromRow(result.rows[0]));
  } catch (err) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Board existiert bereits' });
    }
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.get('/api/boards/:id', auth, async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM boards WHERE id = ? AND userId = ?',
      args: [req.params.id, req.user.id],
    });
    if (!result.rows.length) return res.status(404).json({ error: 'Board nicht gefunden' });
    res.json(boardFromRow(result.rows[0]));
  } catch {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.put('/api/boards/:id', auth, async (req, res) => {
  try {
    const existing = await db.execute({
      sql: 'SELECT * FROM boards WHERE id = ? AND userId = ?',
      args: [req.params.id, req.user.id],
    });
    if (!existing.rows.length) return res.status(404).json({ error: 'Board nicht gefunden' });

    const ts = now();
    const merged = { ...boardFromRow(existing.rows[0]), ...req.body, updatedAt: ts };
    const row = boardToRow(merged);

    await db.execute({
      sql: `UPDATE boards SET type = ?, status = ?, boardName = ?, data = ?, views = ?, clicks = ?, updatedAt = ?
            WHERE id = ? AND userId = ?`,
      args: [row.type, row.status, row.boardName, row.data, row.views, row.clicks, row.updatedAt, req.params.id, req.user.id],
    });

    const result = await db.execute({ sql: 'SELECT * FROM boards WHERE id = ?', args: [req.params.id] });
    res.json(boardFromRow(result.rows[0]));
  } catch {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.delete('/api/boards/:id', auth, async (req, res) => {
  try {
    await db.execute({
      sql: 'DELETE FROM boards WHERE id = ? AND userId = ?',
      args: [req.params.id, req.user.id],
    });
    res.json({ message: 'Gelöscht' });
  } catch {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.patch('/api/boards/:id/status', auth, async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'Status erforderlich' });
  if (!['draft', 'published'].includes(status)) {
    return res.status(400).json({ error: 'Ungültiger Status (draft oder published)' });
  }

  try {
    const ts = now();
    const result = await db.execute({
      sql: 'UPDATE boards SET status = ?, updatedAt = ? WHERE id = ? AND userId = ? RETURNING *',
      args: [status, ts, req.params.id, req.user.id],
    });
    if (!result.rows.length) return res.status(404).json({ error: 'Board nicht gefunden' });
    res.json(boardFromRow(result.rows[0]));
  } catch {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.post('/api/boards/:id/duplicate', auth, async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM boards WHERE id = ? AND userId = ?',
      args: [req.params.id, req.user.id],
    });
    if (!result.rows.length) return res.status(404).json({ error: 'Board nicht gefunden' });

    const original = boardFromRow(result.rows[0]);
    const ts = now();
    const copy = {
      ...original,
      id: uid(),
      embedId: uid(),
      boardName: (original.boardName || '') + ' (Kopie)',
      status: 'draft',
      createdAt: ts,
      updatedAt: ts,
      views: 0,
      clicks: 0,
    };
    const row = boardToRow(copy);

    await db.execute({
      sql: `INSERT INTO boards (id, embedId, userId, type, status, boardName, data, views, clicks, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [row.id, row.embedId, row.userId, row.type, row.status, row.boardName, row.data, row.views, row.clicks, row.createdAt, row.updatedAt],
    });

    res.status(201).json(copy);
  } catch {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ═════════════════════════════════════════════════════════════════
//  Areas Routes
// ═════════════════════════════════════════════════════════════════

app.get('/api/areas', auth, async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM areas WHERE userId = ?',
      args: [req.user.id],
    });
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.post('/api/areas', auth, async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name erforderlich' });

  try {
    const id = uid();
    await db.execute({
      sql: 'INSERT INTO areas (id, userId, name, description) VALUES (?, ?, ?, ?)',
      args: [id, req.user.id, name, description || ''],
    });
    const result = await db.execute({ sql: 'SELECT * FROM areas WHERE id = ?', args: [id] });
    res.status(201).json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.put('/api/areas/:id', auth, async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name erforderlich' });

  try {
    await db.execute({
      sql: 'UPDATE areas SET name = ?, description = ? WHERE id = ? AND userId = ?',
      args: [name, description || '', req.params.id, req.user.id],
    });
    const result = await db.execute({ sql: 'SELECT * FROM areas WHERE id = ?', args: [req.params.id] });
    if (!result.rows.length) return res.status(404).json({ error: 'Bereich nicht gefunden' });
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.delete('/api/areas/:id', auth, async (req, res) => {
  try {
    await db.execute({
      sql: 'DELETE FROM areas WHERE id = ? AND userId = ?',
      args: [req.params.id, req.user.id],
    });
    res.json({ message: 'Gelöscht' });
  } catch {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ═════════════════════════════════════════════════════════════════
//  Embed Routes (public, no auth)
// ═════════════════════════════════════════════════════════════════

app.get('/api/embed/board/:embedId', async (req, res) => {
  try {
    const result = await db.execute({
      sql: "SELECT * FROM boards WHERE embedId = ? AND status = 'published'",
      args: [req.params.embedId],
    });
    if (!result.rows.length) return res.status(404).json({ error: 'Board nicht gefunden' });

    await db.execute({
      sql: 'UPDATE boards SET views = views + 1 WHERE embedId = ?',
      args: [req.params.embedId],
    });

    res.json(boardFromRow(result.rows[0]));
  } catch {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.get('/api/embed/channel/:embedKey', async (req, res) => {
  try {
    const userResult = await db.execute({
      sql: 'SELECT * FROM users WHERE embedKey = ?',
      args: [req.params.embedKey],
    });
    if (!userResult.rows.length) return res.status(404).json({ error: 'Kanal nicht gefunden' });

    const user = userResult.rows[0];
    const boardsResult = await db.execute({
      sql: "SELECT * FROM boards WHERE userId = ? AND status = 'published' ORDER BY updatedAt DESC",
      args: [user.id],
    });

    const brandColors = JSON.parse(user.brandColors || '{}');
    const theme = Object.keys(brandColors).length ? brandColors : null;

    res.json({
      boards: boardsResult.rows.map(boardFromRow),
      theme,
    });
  } catch {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ═════════════════════════════════════════════════════════════════
//  Settings Routes
// ═════════════════════════════════════════════════════════════════

app.get('/api/settings/brand', auth, async (req, res) => {
  try {
    const result = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [req.user.id] });
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'Nutzer nicht gefunden' });

    res.json({
      websiteUrl: user.websiteUrl || '',
      brandColors: JSON.parse(user.brandColors || '{}'),
    });
  } catch {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.put('/api/settings/brand', auth, async (req, res) => {
  const { websiteUrl, brandColors } = req.body;
  try {
    await db.execute({
      sql: 'UPDATE users SET websiteUrl = ?, brandColors = ?, updatedAt = ? WHERE id = ?',
      args: [websiteUrl || '', JSON.stringify(brandColors || {}), now(), req.user.id],
    });
    res.json({ message: 'Gespeichert', websiteUrl, brandColors });
  } catch {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.put('/api/settings/profile', auth, async (req, res) => {
  const { websiteUrl, brandColors } = req.body;
  try {
    await db.execute({
      sql: 'UPDATE users SET websiteUrl = ?, brandColors = ?, updatedAt = ? WHERE id = ?',
      args: [websiteUrl || '', JSON.stringify(brandColors || {}), now(), req.user.id],
    });
    res.json({ message: 'Gespeichert' });
  } catch {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.post('/api/settings/analyze-colors', auth, async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL erforderlich' });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'boards.solutions ColorAnalyzer/1.0' },
    });
    clearTimeout(timeout);

    if (!response.ok) return res.json({ palette: [], semantic: {}, error: `HTTP ${response.status}` });

    const html = await response.text();

    const colorRegex = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
    const rgbRegex = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g;
    const colors = new Set();

    for (const match of html.matchAll(colorRegex)) {
      let hex = match[0].toLowerCase();
      if (hex.length === 4) {
        hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
      }
      if (hex !== '#ffffff' && hex !== '#000000' && hex !== '#fff' && hex !== '#000') {
        colors.add(hex);
      }
    }

    for (const match of html.matchAll(rgbRegex)) {
      const hex = '#' + [match[1], match[2], match[3]]
        .map(n => parseInt(n).toString(16).padStart(2, '0'))
        .join('');
      if (hex !== '#ffffff' && hex !== '#000000') {
        colors.add(hex);
      }
    }

    const palette = [...colors].slice(0, 12);

    const semantic = {};
    if (palette[0]) semantic.primary = palette[0];
    if (palette[1]) semantic.secondary = palette[1];
    if (palette.length > 2) semantic.background = '#ffffff';
    semantic.text = '#0f172a';

    res.json({ palette, semantic });
  } catch (err) {
    res.json({ palette: [], semantic: {}, error: err.message || 'Analyse fehlgeschlagen' });
  }
});

// ═════════════════════════════════════════════════════════════════
//  Admin Routes
// ═════════════════════════════════════════════════════════════════

app.get('/api/admin/stats', auth, adminOnly, async (_req, res) => {
  try {
    const total = await db.execute('SELECT COUNT(*) as count FROM users');
    const active = await db.execute("SELECT COUNT(*) as count FROM users WHERE status = 'active'");
    const pro = await db.execute("SELECT COUNT(*) as count FROM users WHERE plan = 'pro'");
    const business = await db.execute("SELECT COUNT(*) as count FROM users WHERE plan = 'business'");

    res.json({
      totalCustomers: total.rows[0].count,
      activeCustomers: active.rows[0].count,
      proCustomers: pro.rows[0].count,
      businessCustomers: business.rows[0].count,
    });
  } catch {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.get('/api/admin/customers', auth, adminOnly, async (_req, res) => {
  try {
    const result = await db.execute('SELECT * FROM users ORDER BY createdAt DESC');
    const customers = await Promise.all(result.rows.map(async (u) => {
      const boards = await db.execute({ sql: 'SELECT COUNT(*) as count FROM boards WHERE userId = ?', args: [u.id] });
      return {
        id: u.id, name: u.name, email: u.email, company: u.company,
        plan: u.plan, role: u.role, status: u.status, notes: u.notes,
        embedKey: u.embedKey,
        boardCount: boards.rows[0].count,
        createdAt: u.createdAt,
      };
    }));
    res.json(customers);
  } catch {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.post('/api/admin/customers', auth, adminOnly, async (req, res) => {
  const { name, email, password, company, plan, role, status, notes } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, E-Mail und Passwort erforderlich' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Ungültige E-Mail-Adresse' });
  if (!isValidPassword(password)) return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen haben' });

  if (plan && !['free', 'pro', 'business'].includes(plan)) {
    return res.status(400).json({ error: 'Ungültiger Plan' });
  }
  if (role && !['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Ungültige Rolle' });
  }
  if (status && !['active', 'inactive', 'suspended'].includes(status)) {
    return res.status(400).json({ error: 'Ungültiger Status' });
  }

  try {
    const existing = await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email.toLowerCase()] });
    if (existing.rows.length) return res.status(409).json({ error: 'E-Mail bereits registriert' });

    const id = uid();
    const embedKey = 'ek_' + uid();
    const hashed = await bcrypt.hash(password, 10);
    const ts = now();

    await db.execute({
      sql: `INSERT INTO users (id, email, password, name, plan, role, company, embedKey, status, notes, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, email.toLowerCase(), hashed, name, plan || 'free', role || 'user', company || '', embedKey, status || 'active', notes || '', ts, ts],
    });

    res.status(201).json({
      id, name, email: email.toLowerCase(), company: company || '',
      plan: plan || 'free', role: role || 'user', status: status || 'active',
      notes: notes || '', embedKey, boardCount: 0, createdAt: ts,
    });
  } catch {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.put('/api/admin/customers/:id', auth, adminOnly, async (req, res) => {
  const { name, email, password, company, plan, role, status, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Name erforderlich' });

  if (email && !isValidEmail(email)) {
    return res.status(400).json({ error: 'Ungültige E-Mail-Adresse' });
  }
  if (plan && !['free', 'pro', 'business'].includes(plan)) {
    return res.status(400).json({ error: 'Ungültiger Plan' });
  }
  if (role && !['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Ungültige Rolle' });
  }
  if (status && !['active', 'inactive', 'suspended'].includes(status)) {
    return res.status(400).json({ error: 'Ungültiger Status' });
  }

  try {
    const ts = now();
    if (password) {
      if (!isValidPassword(password)) return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen haben' });
      const hashed = await bcrypt.hash(password, 10);
      await db.execute({
        sql: `UPDATE users SET name = ?, email = ?, password = ?, company = ?, plan = ?, role = ?, status = ?, notes = ?, updatedAt = ?
              WHERE id = ?`,
        args: [name, email?.toLowerCase(), hashed, company || '', plan || 'free', role || 'user', status || 'active', notes || '', ts, req.params.id],
      });
    } else {
      await db.execute({
        sql: `UPDATE users SET name = ?, email = ?, company = ?, plan = ?, role = ?, status = ?, notes = ?, updatedAt = ?
              WHERE id = ?`,
        args: [name, email?.toLowerCase(), company || '', plan || 'free', role || 'user', status || 'active', notes || '', ts, req.params.id],
      });
    }

    const result = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [req.params.id] });
    if (!result.rows.length) return res.status(404).json({ error: 'Kunde nicht gefunden' });

    const u = result.rows[0];
    const boards = await db.execute({ sql: 'SELECT COUNT(*) as count FROM boards WHERE userId = ?', args: [u.id] });

    res.json({
      id: u.id, name: u.name, email: u.email, company: u.company,
      plan: u.plan, role: u.role, status: u.status, notes: u.notes,
      embedKey: u.embedKey, boardCount: boards.rows[0].count, createdAt: u.createdAt,
    });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: 'E-Mail bereits vergeben' });
    res.status(500).json({ error: 'Serverfehler' });
  }
});

app.delete('/api/admin/customers/:id', auth, adminOnly, async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [req.params.id] });
    res.json({ message: 'Gelöscht' });
  } catch {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// ═════════════════════════════════════════════════════════════════
//  Backup
// ═════════════════════════════════════════════════════════════════

import { writeFileSync, unlinkSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

const BACKUP_PATH = join('/app/data', 'backup.json');

// Admin: vollständiges Backup aller Daten
app.post('/api/admin/backup', auth, adminOnly, async (_req, res) => {
  try {
    const [users, boards, areas] = await Promise.all([
      db.execute('SELECT * FROM users'),
      db.execute('SELECT * FROM boards'),
      db.execute('SELECT * FROM areas'),
    ]);
    const backup = { createdAt: now(), version: 1, users: users.rows, boards: boards.rows, areas: areas.rows };
    writeFileSync(BACKUP_PATH, JSON.stringify(backup, null, 2), 'utf8');
    res.json({ message: 'Backup erstellt', createdAt: backup.createdAt, boards: boards.rows.length, users: users.rows.length });
  } catch (err) {
    console.error('Backup error:', err);
    res.status(500).json({ error: 'Backup fehlgeschlagen' });
  }
});

app.get('/api/admin/backup', auth, adminOnly, (_req, res) => {
  if (!existsSync(BACKUP_PATH)) return res.status(404).json({ error: 'Kein Backup vorhanden' });
  const data = readFileSync(BACKUP_PATH, 'utf8');
  const parsed = JSON.parse(data);
  res.setHeader('Content-Disposition', `attachment; filename="boards-backup-${parsed.createdAt?.slice(0,10) || 'latest'}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.send(data);
});

app.get('/api/admin/backup/info', auth, adminOnly, (_req, res) => {
  if (!existsSync(BACKUP_PATH)) return res.json({ exists: false });
  const data = JSON.parse(readFileSync(BACKUP_PATH, 'utf8'));
  res.json({ exists: true, createdAt: data.createdAt, boards: data.boards?.length, users: data.users?.length });
});

// User: eigene Boards sichern (für alle eingeloggten Nutzer)
app.post('/api/backup', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const [boards, areas] = await Promise.all([
      db.execute({ sql: 'SELECT * FROM boards WHERE userId = ?', args: [userId] }),
      db.execute({ sql: 'SELECT * FROM areas WHERE userId = ?', args: [userId] }),
    ]);
    const backup = { createdAt: now(), version: 1, userId, boards: boards.rows, areas: areas.rows };
    const userBackupPath = join('/app/data', `backup-${userId}.json`);
    writeFileSync(userBackupPath, JSON.stringify(backup, null, 2), 'utf8');
    res.json({ message: 'Backup erstellt', createdAt: backup.createdAt, boards: boards.rows.length });
  } catch (err) {
    res.status(500).json({ error: 'Backup fehlgeschlagen' });
  }
});

app.get('/api/backup', auth, (req, res) => {
  const userBackupPath = join('/app/data', `backup-${req.user.id}.json`);
  if (!existsSync(userBackupPath)) return res.status(404).json({ error: 'Kein Backup vorhanden' });
  const data = readFileSync(userBackupPath, 'utf8');
  const parsed = JSON.parse(data);
  res.setHeader('Content-Disposition', `attachment; filename="boards-backup-${parsed.createdAt?.slice(0,10) || 'latest'}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.send(data);
});

// ═════════════════════════════════════════════════════════════════
//  Public Board Pages — SEO + Anti-Spam Landing Pages
// ═════════════════════════════════════════════════════════════════

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function textToHtmlBlocks(text) {
  if (!text) return '';
  return text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
    .map(p => `<p>${escHtml(p.replace(/\n/g,' '))}</p>`).join('');
}

function renderBoardPage(board, websiteUrl) {
  const BOARD_BASE = 'https://api.fuerst-software.com/board';
  const title = board.type === 'faq'
    ? (board.faqTitle || board.boardName)
    : (board.title || board.productName || board.boardName || 'Board');

  const desc = (() => {
    if (board.type === 'blog')      return (board.intro || board.content || '').slice(0, 160);
    if (board.type === 'affiliate') return (board.description || '').slice(0, 160);
    if (board.type === 'review')    return (board.reviewText || '').slice(0, 160);
    if (board.type === 'faq')       return (board.faqs?.[0]?.question || '').slice(0, 160);
    return '';
  })();

  const img      = board.image || board.blogImage || board.affImage || board.revImage || '';
  const boardUrl = `${BOARD_BASE}/${board.embedId}`;
  const backUrl  = websiteUrl || 'https://boards.solutions';
  const typeName = { blog:'Blog', affiliate:'Empfehlung', review:'Review', faq:'FAQ' }[board.type] || board.type;

  // ── Content HTML (crawler-visible) ────────────────────────────
  let content = '';
  if (board.type === 'blog') {
    if (board.blocks?.length) {
      content = board.blocks.map(b => {
        if (b.type === 'text' && b.content?.trim()) return `<div>${textToHtmlBlocks(b.content)}</div>`;
        if (b.type === 'image' && b.data) return `<figure><img src="${escHtml(b.data)}" alt="" loading="lazy"></figure>`;
        if (b.type === 'affiliate' && b.url) return `<p><a href="${escHtml(b.url)}" rel="noopener nofollow" target="_blank" class="cta">${escHtml(b.text||'Mehr erfahren')} →</a></p>`;
        return '';
      }).join('');
    } else {
      content = textToHtmlBlocks(board.content || board.intro || '');
      (board.affiliateLinks || []).filter(l=>l.url).forEach(l => {
        content += `<p><a href="${escHtml(l.url)}" rel="noopener nofollow" target="_blank" class="cta">${escHtml(l.text||'Mehr erfahren')} →</a></p>`;
      });
    }
  } else if (board.type === 'affiliate') {
    if (board.rating) content += `<p class="rating">⭐ ${escHtml(String(board.rating))} / 5 Sterne</p>`;
    content += textToHtmlBlocks(board.description || '');
    if (board.price || board.affiliateUrl) {
      content += `<div class="buybox">${board.price?`<span class="price">${escHtml(board.price)}</span>`:''}${board.affiliateUrl?`<a href="${escHtml(board.affiliateUrl)}" rel="noopener nofollow" target="_blank" class="cta">${escHtml(board.buttonText||'Jetzt ansehen')} →</a>`:''}</div>`;
    }
  } else if (board.type === 'review') {
    if (board.rating) content += `<p class="rating">⭐ ${escHtml(String(board.rating))} / 5 Sterne</p>`;
    content += textToHtmlBlocks(board.reviewText || '');
    const pros = (board.pros||[]).filter(Boolean), cons = (board.cons||[]).filter(Boolean);
    if (pros.length || cons.length) {
      content += `<div class="pros-cons">`;
      if (pros.length) content += `<div class="pros"><strong>✓ Vorteile</strong><ul>${pros.map(p=>`<li>${escHtml(p)}</li>`).join('')}</ul></div>`;
      if (cons.length) content += `<div class="cons"><strong>✗ Nachteile</strong><ul>${cons.map(c=>`<li>${escHtml(c)}</li>`).join('')}</ul></div>`;
      content += `</div>`;
    }
    if (board.verdict) content += `<div class="verdict"><strong>Fazit:</strong> ${escHtml(board.verdict)}</div>`;
    if (board.affiliateUrl) content += `<div class="buybox">${board.price?`<span class="price">${escHtml(board.price)}</span>`:''}<a href="${escHtml(board.affiliateUrl)}" rel="noopener nofollow" target="_blank" class="cta">${escHtml(board.buttonText||'Preis prüfen')} →</a></div>`;
  } else if (board.type === 'faq') {
    content = (board.faqs||[]).map(f=>`<div class="faq-item"><h3>${escHtml(f.question||f.q||'')}</h3><p>${escHtml(f.answer||f.a||'')}</p></div>`).join('');
  }

  const tags = (board.tags||[]);

  // ── JSON-LD ───────────────────────────────────────────────────
  const jsonLd = JSON.stringify(board.type === 'faq' ? {
    '@context':'https://schema.org','@type':'FAQPage',
    mainEntity: (board.faqs||[]).map(f=>({'@type':'Question','name':f.question||f.q||'',acceptedAnswer:{'@type':'Answer','text':f.answer||f.a||''}}))
  } : {
    '@context':'https://schema.org','@type':'Article',
    headline: title, description: desc, url: boardUrl,
    ...(img ? {image: img} : {})
  });

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(title)}</title>
<meta name="description" content="${escHtml(desc)}">
<link rel="canonical" href="${escHtml(boardUrl)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${escHtml(title)}">
<meta property="og:description" content="${escHtml(desc)}">
<meta property="og:url" content="${escHtml(boardUrl)}">
${img?`<meta property="og:image" content="${escHtml(img)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${escHtml(img)}">`:`<meta name="twitter:card" content="summary">`}
<meta name="twitter:title" content="${escHtml(title)}">
<meta name="twitter:description" content="${escHtml(desc)}">
<script type="application/ld+json">${jsonLd}</script>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;background:#f8fafc;line-height:1.75}
.back{background:#fff;border-bottom:1px solid #e2e8f0;padding:12px 20px}
.back a{color:#64748b;text-decoration:none;font-size:13px}
.back a:hover{color:#0b4fd8}
.wrap{max-width:740px;margin:0 auto;padding:36px 20px 64px}
.badge{display:inline-block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;padding:3px 10px;border-radius:999px;background:#eff3fd;color:#0b4fd8;margin-bottom:16px}
h1{font-size:clamp(1.4rem,4vw,2rem);font-weight:700;line-height:1.25;letter-spacing:-.02em;margin-bottom:28px}
h3{font-size:1rem;font-weight:600;margin-bottom:6px;color:#0f172a}
.hero{width:100%;height:auto;border-radius:16px;margin-bottom:28px;display:block}
p{margin-bottom:1em;color:#374151;font-size:1rem}
figure{margin:20px 0}figure img{width:100%;border-radius:10px}
.rating{font-size:1rem;margin-bottom:16px}
.buybox{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:20px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;margin:20px 0}
.price{font-size:1.5rem;font-weight:700}
.cta{display:inline-block;padding:10px 22px;background:#0b4fd8;color:#fff;text-decoration:none;border-radius:999px;font-weight:600;font-size:.9rem}
.pros-cons{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:20px 0}
@media(max-width:500px){.pros-cons{grid-template-columns:1fr}}
.pros,.cons{background:#fff;border-radius:12px;padding:16px}
.pros{border-top:3px solid #16a34a}.cons{border-top:3px solid #dc2626}
.pros strong{color:#16a34a;font-size:.75rem;text-transform:uppercase;letter-spacing:.06em}
.cons strong{color:#dc2626;font-size:.75rem;text-transform:uppercase;letter-spacing:.06em}
ul{margin:8px 0 0 18px}li{margin-bottom:4px;font-size:.9rem;color:#374151}
.verdict{padding:16px;background:#f0f4ff;border-left:3px solid #0b4fd8;border-radius:0 10px 10px 0;margin:20px 0;font-size:.95rem}
.faq-item{border-bottom:1px solid #e2e8f0;padding:20px 0}.faq-item:first-child{padding-top:0}.faq-item:last-child{border-bottom:none}
.tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:28px;padding-top:20px;border-top:1px solid #e2e8f0}
.tag{font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;padding:3px 9px;border-radius:999px;background:#f1f5f9;color:#64748b}
.footer{text-align:center;padding:24px;color:#94a3b8;font-size:.75rem;border-top:1px solid #e2e8f0;margin-top:40px}
.footer a{color:#94a3b8}
</style>
</head>
<body>
<div class="back"><a href="${escHtml(backUrl)}">← Zurück zur Website</a></div>
<div class="wrap">
  <span class="badge">${escHtml(typeName)}</span>
  ${img?`<img class="hero" src="${escHtml(img)}" alt="${escHtml(title)}" loading="eager">`:''}
  <h1>${escHtml(title)}</h1>
  ${content}
  ${tags.length?`<div class="tags">${tags.map(t=>`<span class="tag">${escHtml(t)}</span>`).join('')}</div>`:''}
</div>
<div class="footer"><a href="https://boards.solutions" rel="noopener">boards.solutions</a></div>
</body>
</html>`;
}

app.get('/board/:embedId', async (req, res) => {
  try {
    const result = await db.execute({
      sql: "SELECT b.*, u.websiteUrl FROM boards b JOIN users u ON b.userId = u.id WHERE b.embedId = ? AND b.status = 'published'",
      args: [req.params.embedId],
    });
    if (!result.rows.length) return res.status(404).send('<h1>Board nicht gefunden</h1>');
    const row = result.rows[0];
    const board = boardFromRow(row);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(renderBoardPage(board, row.websiteUrl || ''));
  } catch (err) {
    console.error('Board page error:', err);
    res.status(500).send('<h1>Serverfehler</h1>');
  }
});

app.get('/sitemap.xml', async (_req, res) => {
  try {
    const result = await db.execute("SELECT embedId, updatedAt FROM boards WHERE status = 'published' ORDER BY updatedAt DESC");
    const urls = result.rows.map(r =>
      `  <url><loc>https://api.fuerst-software.com/board/${r.embedId}</loc><lastmod>${(r.updatedAt||'').slice(0,10)||new Date().toISOString().slice(0,10)}</lastmod><changefreq>weekly</changefreq></url>`
    ).join('\n');
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`);
  } catch {
    res.status(500).send('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  }
});

app.get('/robots.txt', (_req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send('User-agent: *\nAllow: /board/\nSitemap: https://api.fuerst-software.com/sitemap.xml\n');
});

// ═════════════════════════════════════════════════════════════════
//  Seed admin user if no users exist
// ═════════════════════════════════════════════════════════════════

async function seedAdmin() {
  const result = await db.execute('SELECT COUNT(*) as count FROM users');
  if (result.rows[0].count > 0) return;

  const hashed = await bcrypt.hash('Admin1234', 10);
  const ts = now();
  await db.execute({
    sql: `INSERT INTO users (id, email, password, name, plan, role, company, embedKey, status, notes, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: ['m4kkmhtt23la', 'admin@boards.solutions', hashed, 'Administrator', 'pro', 'admin', 'boards.solutions', 'gc4ea40706q4ji30', 'active', '', ts, ts],
  });
  console.log('Admin user seeded: admin@boards.solutions / Admin1234');
}

// ═════════════════════════════════════════════════════════════════
//  Start
// ═════════════════════════════════════════════════════════════════

// Global error handler (always last)
app.use((err, req, res, _next) => {
  console.error('Unerwarteter Fehler:', err.message);
  res.status(500).json({ error: 'Serverfehler' });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint nicht gefunden' });
});

await initDb();
await seedAdmin();

app.listen(PORT, () => {
  console.log(`📡 boards.solutions backend running on port ${PORT}`);
  console.log(`🗄️  Database: Turso (${process.env.TURSO_DATABASE_URL || 'local file'})`);
  console.log(`🔐 JWT Secret: ${process.env.JWT_SECRET ? '✓ set' : '⚠️  using default (change in production!)'}`);
});
