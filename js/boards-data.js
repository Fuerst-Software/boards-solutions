/**
 * boards.solutions — Board Data Layer  v5
 *
 * Write-through cache + stale-while-revalidate.
 * Per-user localStorage keys — no cross-user data leakage.
 * Dispatches 'bs:boards-updated' custom event on every cache write.
 */

import { authHeaders, getToken, clearAuth } from './auth.js';
import { API_URL } from './config.js';

const API_BASE         = API_URL;
const API_TIMEOUT      = 15000;  // health check (same as save — handles Railway cold start)
const API_SAVE_TIMEOUT = 15000;  // save / mutate operations
const CACHE_VER        = 'v5';

// ── Per-user cache key ────────────────────────────────────────────
function cacheKey() {
  try {
    const raw = localStorage.getItem('bs_auth_user');
    const u   = raw ? JSON.parse(raw) : null;
    return u?.id ? `bs_boards_${u.id}_${CACHE_VER}` : `bs_boards_anon_${CACHE_VER}`;
  } catch { return `bs_boards_anon_${CACHE_VER}`; }
}

// ── API health singleton with promise deduplication ───────────────
let _apiOk      = null;
let _apiPromise = null;

async function apiOk() {
  if (_apiOk !== null) return _apiOk;
  if (_apiPromise)     return _apiPromise;
  if (!getToken()) { _apiOk = false; return false; }
  _apiPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(API_TIMEOUT) });
      _apiOk = res.ok;
    } catch { _apiOk = false; }
    _apiPromise = null;
    return _apiOk;
  })();
  return _apiPromise;
}

export function resetApiState() {
  _apiOk      = null;
  _apiPromise = null;
}

/** Clear all boards caches for all users (call on logout) */
export function clearBoardsCache() {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith('bs_boards_'))
      .forEach(k => localStorage.removeItem(k));
    // Also remove legacy key
    localStorage.removeItem('boards_solutions_v1');
  } catch {}
  resetApiState();
}

// ── localStorage helpers ──────────────────────────────────────────
function lsGet() {
  try { return JSON.parse(localStorage.getItem(cacheKey()) || '[]'); }
  catch { return []; }
}

const IMAGE_KEYS = ['image', 'blogImage', 'affImage'];

function stripImages(board) {
  const b = { ...board };
  IMAGE_KEYS.forEach(k => delete b[k]);
  return b;
}

function lsSet(boards) {
  try {
    const lean = boards.map(stripImages);
    localStorage.setItem(cacheKey(), JSON.stringify(lean));
    window.dispatchEvent(new CustomEvent('bs:boards-updated', { detail: { boards: lean } }));
  } catch { /* quota */ }
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function apiHeaders(extra = {}) {
  return { ...authHeaders(), 'Content-Type': 'application/json', ...extra };
}

function _filter(boards, { type, status, q } = {}) {
  let result = boards;
  if (type)   result = result.filter(b => b.type === type);
  if (status) result = result.filter(b => b.status === status);
  if (q) {
    const lq = q.toLowerCase();
    result = result.filter(b =>
      (b.boardName   || '').toLowerCase().includes(lq) ||
      (b.title       || '').toLowerCase().includes(lq) ||
      (b.productName || '').toLowerCase().includes(lq)
    );
  }
  return result;
}

// ── Raw API calls ─────────────────────────────────────────────────
async function apiFetchBoards({ type, status, q } = {}) {
  try {
    const p = new URLSearchParams();
    if (type)   p.set('type',   type);
    if (status) p.set('status', status);
    if (q)      p.set('q',      q);
    const res = await fetch(`${API_BASE}/boards?${p}`, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(API_SAVE_TIMEOUT),
    });
    if (res.status === 401) { clearAuth(); window.location.href = 'login.html?reason=session_expired'; return null; }
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data : null;
  } catch { return null; }
}

/** Background stale-while-revalidate refresh — updates cache silently */
function backgroundRefresh() {
  if (!getToken() || _apiOk === false) return;
  setTimeout(async () => {
    try {
      if (!await apiOk()) return;
      const fresh = await apiFetchBoards();
      if (fresh !== null) lsSet(fresh);
    } catch {}
  }, 0);
}

// ═══════════════════════════════════════════════════════════════════
//  Public API
// ═══════════════════════════════════════════════════════════════════

/**
 * Get boards — stale-while-revalidate.
 * Returns cached data instantly, refreshes in background.
 */
export async function getBoards({ type, status, q } = {}) {
  if (!getToken()) return [];

  const cached = lsGet();

  // Always start a background refresh so the UI updates with server data
  backgroundRefresh();

  // Have cache → return immediately (stale-while-revalidate)
  if (cached.length > 0) {
    return _filter(cached, { type, status, q });
  }

  // Empty cache → blocking fetch from API
  const fresh = await apiFetchBoards({ type, status, q });
  if (fresh !== null) {
    lsSet(fresh);
    _apiOk = true;
    return _filter(fresh, { type, status, q });
  }
  return [];
}

/**
 * Save board — optimistic write-through.
 * Writes to localStorage immediately, then syncs to API in background.
 */
export async function saveBoard(boardData) {
  const boards = lsGet();
  const now    = new Date().toISOString();
  let saved;

  if (boardData.id) {
    const idx = boards.findIndex(b => b.id === boardData.id);
    if (idx >= 0) {
      saved = { ...boards[idx], ...boardData, updatedAt: now };
      boards[idx] = saved;
    } else {
      saved = { ...boardData, updatedAt: now };
      boards.unshift(saved);
    }
  } else {
    saved = {
      ...boardData,
      id:        uid(),
      embedId:   uid(),
      createdAt: now,
      updatedAt: now,
      views:     0,
      clicks:    0,
    };
    boards.unshift(saved);
  }

  lsSet(boards);

  // API sync — blocking, throws on failure so UI can show error
  if (!getToken()) return saved; // offline / demo mode
  try {
    const method = boardData.id ? 'PUT' : 'POST';
    const url    = boardData.id
      ? `${API_BASE}/boards/${boardData.id}`
      : `${API_BASE}/boards`;
    const res = await fetch(url, {
      method,
      headers: apiHeaders(),
      body: JSON.stringify(saved),
      signal: AbortSignal.timeout(API_SAVE_TIMEOUT),
    });
    if (!res.ok) {
      if (res.status === 401) {
        // Token expired or invalid — clear auth and redirect to login
        clearAuth();
        window.location.href = 'login.html?reason=session_expired';
        return saved;
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const serverBoard = await res.json();
    // Merge server response into cache (server may assign real IDs)
    const fresh = lsGet();
    const fi = fresh.findIndex(b => b.id === saved.id);
    if (fi >= 0) { fresh[fi] = { ...fresh[fi], ...serverBoard }; lsSet(fresh); }
    _apiOk = true; // mark API as reachable
    return fresh[fi] ?? saved;
  } catch (err) {
    // Do NOT rollback localStorage — board stays visible locally.
    // Mark as sync-pending so boards.html can auto-retry on next load.
    const pending = lsGet();
    const pi = pending.findIndex(b => b.id === saved.id);
    if (pi >= 0) { pending[pi]._syncPending = true; lsSet(pending); }
    err.localBoard = saved;
    throw err; // bubble up so UI shows toast error
  }
}

// Retries POST for all boards marked _syncPending (API sync failed on creation).
// Returns number of successfully synced boards.
export async function retrySyncPending() {
  if (!getToken() || !(await apiOk())) return 0;
  const boards  = lsGet();
  const pending = boards.filter(b => b._syncPending);
  if (!pending.length) return 0;

  let synced = 0;
  for (const board of pending) {
    try {
      const { _syncPending, ...payload } = board;
      const res = await fetch(`${API_BASE}/boards`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(API_SAVE_TIMEOUT),
      });
      if (res.ok) {
        const created = await res.json();
        const fresh = lsGet();
        const fi = fresh.findIndex(b => b.id === board.id);
        if (fi >= 0) { fresh[fi] = { ...fresh[fi], ...created, _syncPending: undefined }; lsSet(fresh); }
        synced++;
      }
    } catch { /* skip, will retry next time */ }
  }
  return synced;
}

// Force-syncs a single board from localStorage to DB (POST if missing, PUT if exists).
export async function resyncBoard(id) {
  if (!getToken()) throw new Error('Nicht eingeloggt');
  const boards = lsGet();
  const board  = boards.find(b => b.id === id);
  if (!board) throw new Error('Board nicht im lokalen Speicher gefunden');

  const { _syncPending, ...payload } = board;

  // Always publish when resyncing
  const syncPayload = { ...payload, status: 'published' };

  // Try PUT first (board might already exist in DB)
  const putRes = await fetch(`${API_BASE}/boards/${id}`, {
    method: 'PUT',
    headers: apiHeaders(),
    body: JSON.stringify(syncPayload),
    signal: AbortSignal.timeout(API_SAVE_TIMEOUT),
  });

  if (putRes.ok) {
    const updated = await putRes.json();
    const fresh = lsGet();
    const fi = fresh.findIndex(b => b.id === id);
    if (fi >= 0) { fresh[fi] = { ...fresh[fi], ...updated, _syncPending: undefined }; lsSet(fresh); }
    return fresh[fi] ?? updated;
  }

  // 404 → board not in DB yet, create it
  if (putRes.status === 404) {
    const postRes = await fetch(`${API_BASE}/boards`, {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify(syncPayload),
      signal: AbortSignal.timeout(API_SAVE_TIMEOUT),
    });
    if (!postRes.ok) {
      const err = await postRes.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${postRes.status}`);
    }
    const created = await postRes.json();
    const fresh = lsGet();
    const fi = fresh.findIndex(b => b.id === id);
    if (fi >= 0) { fresh[fi] = { ...fresh[fi], ...created, _syncPending: undefined }; lsSet(fresh); }
    return fresh[fi] ?? created;
  }

  const err = await putRes.json().catch(() => ({}));
  throw new Error(err.error || `HTTP ${putRes.status}`);
}

export async function deleteBoard(id) {
  // Optimistic: remove from cache immediately
  lsSet(lsGet().filter(b => b.id !== id));

  if (await apiOk()) {
    try {
      await fetch(`${API_BASE}/boards/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
        signal: AbortSignal.timeout(API_SAVE_TIMEOUT),
      });
    } catch {}
  }
}

export async function getBoardById(id) {
  // Always fetch from API — cache only holds stripped (no-image) versions
  try {
    const res = await fetch(`${API_BASE}/boards/${id}`, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(API_SAVE_TIMEOUT),
    });
    if (res.ok) return res.json();
  } catch {}
  // Fall back to cache if API is unreachable
  return lsGet().find(b => b.id === id) ?? null;
}

export async function toggleBoardStatus(id, status) {
  // Optimistic update
  const boards = lsGet();
  const now    = new Date().toISOString();
  const idx    = boards.findIndex(b => b.id === id);
  if (idx >= 0) {
    boards[idx] = { ...boards[idx], status, updatedAt: now };
    lsSet(boards);
  }

  if (await apiOk()) {
    try {
      const res = await fetch(`${API_BASE}/boards/${id}/status`, {
        method: 'PATCH',
        headers: apiHeaders(),
        body: JSON.stringify({ status }),
        signal: AbortSignal.timeout(API_SAVE_TIMEOUT),
      });
      if (res.ok) {
        const updated = await res.json();
        const fresh = lsGet();
        const fi = fresh.findIndex(b => b.id === id);
        if (fi >= 0) { fresh[fi] = { ...fresh[fi], ...updated }; lsSet(fresh); }
        return updated;
      }
      // Board existiert nicht in der DB (nur localStorage) → als neues Board anlegen
      if (res.status === 404 && boards[idx]) {
        const boardToSync = { ...boards[idx], status, updatedAt: now };
        const createRes = await fetch(`${API_BASE}/boards`, {
          method: 'POST',
          headers: apiHeaders(),
          body: JSON.stringify(boardToSync),
          signal: AbortSignal.timeout(API_SAVE_TIMEOUT),
        });
        if (createRes.ok) {
          const created = await createRes.json();
          const fresh = lsGet();
          const fi = fresh.findIndex(b => b.id === id);
          if (fi >= 0) { fresh[fi] = { ...fresh[fi], ...created }; lsSet(fresh); }
          return created;
        }
      }
    } catch {}
  }

  return boards[idx] ?? null;
}

export async function duplicateBoard(id) {
  const boards   = lsGet();
  const original = boards.find(b => b.id === id);
  if (!original) return null;

  const now  = new Date().toISOString();
  const copy = {
    ...original,
    id:        uid(),
    embedId:   uid(),
    boardName: (original.boardName || '') + ' (Kopie)',
    status:    'draft',
    createdAt: now,
    updatedAt: now,
    views:     0,
    clicks:    0,
  };
  boards.unshift(copy);
  lsSet(boards);

  if (await apiOk()) {
    try {
      const res = await fetch(`${API_BASE}/boards/${id}/duplicate`, {
        method: 'POST',
        headers: authHeaders(),
        signal: AbortSignal.timeout(API_SAVE_TIMEOUT),
      });
      if (res.ok) {
        const serverCopy = await res.json();
        // Replace local copy with server copy
        const fresh = lsGet();
        const fi = fresh.findIndex(b => b.id === copy.id);
        if (fi >= 0) { fresh[fi] = serverCopy; lsSet(fresh); }
        return serverCopy;
      }
    } catch {}
  }

  return copy;
}

export function trackView(id) {
  const boards = lsGet();
  const idx = boards.findIndex(b => b.id === id);
  if (idx >= 0) {
    boards[idx].views = (boards[idx].views || 0) + 1;
    lsSet(boards);
  }
}

export function trackClick(id) {
  const boards = lsGet();
  const idx = boards.findIndex(b => b.id === id);
  if (idx >= 0) {
    boards[idx].clicks = (boards[idx].clicks || 0) + 1;
    lsSet(boards);
  }
}

// ── Utilities ─────────────────────────────────────────────────────

export function relativeDate(isoString) {
  if (!isoString) return '';
  const diff  = Date.now() - new Date(isoString).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  <  2)  return 'Gerade eben';
  if (mins  < 60)  return `vor ${mins} Min.`;
  if (hours < 24)  return `vor ${hours} Std.`;
  if (days === 1)  return 'Gestern';
  if (days  <  7)  return `vor ${days} Tagen`;
  return new Date(isoString).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const CHANNEL_JS_URL = API_URL.replace('/api', '') + '/channel.js';

export function buildUserSnippet(embedKey) {
  return `<script\n        src="${CHANNEL_JS_URL}"\n        data-key="${embedKey}"\n        defer>\n      <\/script>`;
}

export function buildSnippet(embedId) {
  return `<script src="https://cdn.boards.solutions/embed.js" data-board="${embedId}" defer><\/script>`;
}

export function buildAreaSnippet(embedKey, areaId) {
  return `<script\n        src="${CHANNEL_JS_URL}"\n        data-key="${embedKey}"\n        data-area="${areaId}"\n        defer>\n      <\/script>`;
}

export function getStats() {
  const boards = lsGet();
  return {
    total:     boards.length,
    published: boards.filter(b => b.status === 'published').length,
    drafts:    boards.filter(b => b.status === 'draft').length,
    views:     boards.reduce((s, b) => s + (b.views || 0), 0),
    clicks:    boards.reduce((s, b) => s + (b.clicks || 0), 0),
    byType: {
      blog:       boards.filter(b => b.type === 'blog').length,
      affiliate:  boards.filter(b => b.type === 'affiliate').length,
      review:     boards.filter(b => b.type === 'review').length,
      faq:        boards.filter(b => b.type === 'faq').length,
      comparison: boards.filter(b => b.type === 'comparison').length,
      newsletter: boards.filter(b => b.type === 'newsletter').length,
    },
  };
}

// ═══════════════════════════════════════════════════════════════
//  Website Areas API
// ═══════════════════════════════════════════════════════════════

export async function getAreas() {
  if (!getToken()) return [];
  try {
    const res = await fetch(`${API_BASE}/areas`, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(API_SAVE_TIMEOUT),
    });
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

export async function saveArea(areaData) {
  const method = areaData.id ? 'PUT' : 'POST';
  const url    = areaData.id ? `${API_BASE}/areas/${areaData.id}` : `${API_BASE}/areas`;
  const res = await fetch(url, {
    method,
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(areaData),
    signal: AbortSignal.timeout(API_SAVE_TIMEOUT),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function deleteArea(id) {
  const res = await fetch(`${API_BASE}/areas/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
    signal: AbortSignal.timeout(API_SAVE_TIMEOUT),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

// ── Demo data seeding (disabled) ────────────────────────────────────
export function seedDemoData() {
  // intentionally a no-op: new accounts start with zero boards
}
