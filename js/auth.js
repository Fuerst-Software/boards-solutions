/**
 * boards.solutions — Authentication Utilities  v2.0
 *
 * JWT-based auth. Token stored in localStorage.
 * Import this module on every dashboard and admin page.
 */

export const TOKEN_KEY = 'bs_auth_token';
export const USER_KEY  = 'bs_auth_user';

// ── Token / User storage ───────────────────────────────────────

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

export function getEmbedKey() {
  return getUser()?.embedKey || null;
}

export function setAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function updateUserLocally(updates) {
  const current = getUser() || {};
  const merged  = { ...current, ...updates };
  localStorage.setItem(USER_KEY, JSON.stringify(merged));
  updateSidebar();
}

// ── Checks ─────────────────────────────────────────────────────

export function isLoggedIn() {
  return !!getToken();
}

export function isAdmin() {
  return getUser()?.role === 'admin';
}

// ── Headers ────────────────────────────────────────────────────

export function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Guards ─────────────────────────────────────────────────────

export function requireAuth() {
  if (!isLoggedIn()) {
    // Loop-Detection: verhindert Ping-Pong zwischen Login ↔ App
    const key   = '_auth_redirects';
    const now   = Date.now();
    const entry = JSON.parse(sessionStorage.getItem(key) || '{"count":0,"since":0}');
    if (now - entry.since < 5000) {
      entry.count++;
    } else {
      entry.count = 1;
      entry.since = now;
    }
    sessionStorage.setItem(key, JSON.stringify(entry));
    if (entry.count > 3) {
      // Echte Schleife erkannt → Auth komplett löschen + auf Login bleiben
      clearAuth();
      sessionStorage.removeItem(key);
    }
    window.location.replace('login.html');
    return false;
  }
  sessionStorage.removeItem('_auth_redirects');
  return true;
}

export function requireAdmin() {
  if (!isLoggedIn()) {
    window.location.replace('login.html');
    return false;
  }
  if (!isAdmin()) {
    window.location.replace('app.html');
    return false;
  }
  return true;
}

export function logout() {
  // Clear all board caches synchronously before navigating
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith('bs_boards_'))
      .forEach(k => localStorage.removeItem(k));
  } catch {}
  clearAuth();
  window.location.replace('login.html');
}

// ── Sidebar / Topbar hydration ──────────────────────────────────

const PLAN_LABELS = {
  free:     'Free Plan',
  pro:      'Pro Plan',
  business: 'Business Plan',
};

const PLAN_BADGE_CLASSES = {
  free:     'badge--neutral',
  pro:      'badge--info',
  business: 'badge--success',
};

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Populate sidebar + topbar with current user's data.
 * Safe to call multiple times — idempotent by guard flag.
 */
export function updateSidebar() {
  const user = getUser();
  if (!user) return;

  const name       = user.name || user.email || 'Nutzer';
  const email      = user.email || '';
  const initials   = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const planLabel  = PLAN_LABELS[user.plan]       || 'Free Plan';
  const planBadge  = PLAN_BADGE_CLASSES[user.plan] || 'badge--neutral';

  document.querySelectorAll('.sidebar__user-name, .topbar__user-name').forEach(el => {
    el.textContent = name;
  });
  document.querySelectorAll('.sidebar__avatar, .topbar__avatar').forEach(el => {
    el.textContent = initials;
  });
  document.querySelectorAll('.sidebar__user-plan').forEach(el => {
    el.textContent = planLabel;
  });
  document.querySelectorAll('.sidebar__user-email').forEach(el => {
    el.textContent = email;
  });

  // ── Rich user card in topbar dropdown ──────────────────────
  const dropdown = document.getElementById('user-menu-dropdown');
  if (dropdown && !dropdown.querySelector('.user-menu__user-card')) {
    const card = document.createElement('div');
    card.className = 'user-menu__user-card';
    card.setAttribute('aria-hidden', 'true');
    card.innerHTML = `
      <div class="user-menu__card-avatar">${escHtml(initials)}</div>
      <div class="user-menu__card-info">
        <span class="user-menu__card-name">${escHtml(name)}</span>
        <span class="user-menu__card-email">${escHtml(email)}</span>
      </div>
      <span class="badge ${escHtml(planBadge)} user-menu__card-plan">${escHtml(planLabel)}</span>
    `;
    const divider = document.createElement('div');
    divider.className = 'user-menu__divider';
    dropdown.prepend(divider);
    dropdown.prepend(card);
  } else if (dropdown) {
    const cardAvatar = dropdown.querySelector('.user-menu__card-avatar');
    const cardName   = dropdown.querySelector('.user-menu__card-name');
    const cardEmail  = dropdown.querySelector('.user-menu__card-email');
    const cardPlan   = dropdown.querySelector('.user-menu__card-plan');
    if (cardAvatar) cardAvatar.textContent = initials;
    if (cardName)   cardName.textContent   = name;
    if (cardEmail)  cardEmail.textContent  = email;
    if (cardPlan) {
      cardPlan.textContent = planLabel;
      cardPlan.className   = `badge ${planBadge} user-menu__card-plan`;
    }
  }

  if (isAdmin()) {
    document.querySelectorAll('[data-admin-only]').forEach(el => {
      el.hidden = false;
    });
  }

  document.querySelectorAll('[data-logout]').forEach(el => {
    if (!el.dataset.logoutBound) {
      el.dataset.logoutBound = '1';
      el.addEventListener('click', e => { e.preventDefault(); logout(); });
    }
  });
}

/**
 * Synchronous sidebar pre-fill — call this from an inline <script> (non-module)
 * at the top of each dashboard page to eliminate the "Max Mustermann" flash.
 * This runs before any module loading delays.
 */
export function preFillSidebar() {
  try {
    const raw  = localStorage.getItem(USER_KEY);
    if (!raw) return;
    const user = JSON.parse(raw);
    const name = user.name || user.email || '';
    const initials = name.split(' ').map(w => (w[0] || '')).join('').slice(0, 2).toUpperCase();
    document.querySelectorAll('.sidebar__user-name, .topbar__user-name').forEach(el => { el.textContent = name; });
    document.querySelectorAll('.sidebar__avatar, .topbar__avatar').forEach(el => { el.textContent = initials; });
    document.querySelectorAll('.sidebar__user-plan').forEach(el => {
      el.textContent = PLAN_LABELS[user.plan] || 'Free Plan';
    });
    document.querySelectorAll('.sidebar__user-email').forEach(el => { el.textContent = user.email || ''; });
  } catch { /* ignore */ }
}
