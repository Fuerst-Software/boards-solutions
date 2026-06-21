import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db, { initDb } from './db.js';

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'boards-solutions-secret-change-me';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── Helpers ──────────────────────────────────────────────────────

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function now() {
  return new Date().toISOString();
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
  if (password.length < 8) return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen haben' });

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

  try {
    const ts = now();
    if (password) {
      if (password.length < 8) return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen haben' });
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

await initDb();
await seedAdmin();

app.listen(PORT, () => {
  console.log(`boards.solutions backend running on port ${PORT}`);
  console.log(`Database: Turso (${process.env.TURSO_DATABASE_URL || 'local file'})`);
});
