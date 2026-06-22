#!/usr/bin/env node
/**
 * API Test Suite für boards.solutions Backend
 *
 * Testet alle 19 Endpoints nach einem lokalen Start:
 *   npm start &
 *   npm run test-api
 *
 * Alle Tests müssen PASS sein, bevor der Backend in Production geht.
 */

const API_BASE = 'http://localhost:3000/api';
const ADMIN_EMAIL = 'admin@boards.solutions';
const ADMIN_PASS = 'Admin1234';

let token = null;
let testResults = [];

function test(name, condition, details = '') {
  const pass = condition === true;
  testResults.push({ name, pass, details });
  console.log(`  ${pass ? '✅' : '❌'} ${name}${details ? ` (${details})` : ''}`);
  if (!pass) process.exitCode = 1;
}

async function api(method, path, body = null, headers = {}) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };
  if (body) options.body = JSON.stringify(body);

  try {
    const res = await fetch(`${API_BASE}${path}`, options);
    let data = {};
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const text = await res.text();
      if (text) data = JSON.parse(text);
    }
    return { status: res.status, data };
  } catch (err) {
    return { status: 0, error: err.message, data: {} };
  }
}

async function runTests() {
  console.log('\n🧪 Starte API-Tests...\n');

  // ─────────────────────────────────────────────────
  // Health Check
  // ─────────────────────────────────────────────────
  console.log('📊 Health Check');
  let res = await api('GET', '/health');
  test('Health endpoint', res.status === 200);
  test('Database is Turso', res.data.db === 'turso');

  // ─────────────────────────────────────────────────
  // Auth Tests
  // ─────────────────────────────────────────────────
  console.log('\n🔐 Auth Endpoints');

  // Invalid email format
  res = await api('POST', '/auth/login', {
    email: 'invalid-email',
    password: 'Test12345',
  });
  test('Reject invalid email', res.status === 400);

  // Invalid password (too short)
  res = await api('POST', '/auth/login', {
    email: 'admin@boards.solutions',
    password: 'short',
  });
  test('Reject short password', res.status === 400 || res.status === 401);

  // Valid login
  res = await api('POST', '/auth/login', {
    email: ADMIN_EMAIL,
    password: ADMIN_PASS,
  });
  test('Admin login succeeds', res.status === 200);
  test('Token provided', res.data.token && res.data.token.length > 20);
  if (res.data.token) {
    token = res.data.token;
  }

  if (!token) {
    console.log('\n❌ Kein Token! Kann Tests nicht fortsetzen.');
    process.exit(1);
  }

  const headers = { Authorization: `Bearer ${token}` };

  // GET /auth/me
  res = await api('GET', '/auth/me', null, headers);
  test('GET /auth/me', res.status === 200);
  test('User email korrekt', res.data.email === ADMIN_EMAIL);

  // PUT /auth/profile
  res = await api('PUT', '/auth/profile', {
    name: 'Test Admin',
    company: 'Test Co',
  }, headers);
  test('PUT /auth/profile', res.status === 200);
  test('Name aktualisiert', res.data.name === 'Test Admin');

  // POST /auth/change-password (same password, should work)
  res = await api('POST', '/auth/change-password', {
    oldPassword: ADMIN_PASS,
    newPassword: ADMIN_PASS,
  }, headers);
  test('POST /auth/change-password', res.status === 200);

  // ─────────────────────────────────────────────────
  // Boards Tests
  // ─────────────────────────────────────────────────
  console.log('\n📋 Boards Endpoints');

  // POST /boards (create)
  res = await api('POST', '/boards', {
    type: 'blog',
    boardName: 'Test Blog',
    title: 'Mein Test Blog',
    content: 'Test Inhalt',
  }, headers);
  test('POST /boards (create)', res.status === 201, `Status: ${res.status}`);
  test('Board has ID', res.data && res.data.id && res.data.id.length > 5, res.data ? res.data.id : res.data);

  let boardId = res.data?.id || 'error';

  // GET /boards (list)
  res = await api('GET', '/boards', null, headers);
  test('GET /boards', res.status === 200);
  test('Boards ist Array', Array.isArray(res.data));
  test('Mind. 1 Board', res.data.length >= 1);

  // GET /boards with filters
  res = await api('GET', '/boards?type=blog', null, headers);
  test('GET /boards mit Filter', res.status === 200);

  // GET /boards/:id
  res = await api('GET', `/boards/${boardId}`, null, headers);
  test('GET /boards/:id', res.status === 200);
  test('Board ID korrekt', res.data.id === boardId);

  // PUT /boards/:id (update)
  res = await api('PUT', `/boards/${boardId}`, {
    title: 'Aktualisierter Titel',
  }, headers);
  test('PUT /boards/:id', res.status === 200);
  test('Title aktualisiert', res.data.title === 'Aktualisierter Titel');

  // PATCH /boards/:id/status
  res = await api('PATCH', `/boards/${boardId}/status`, {
    status: 'published',
  }, headers);
  test('PATCH /boards/:id/status', res.status === 200);
  test('Status ist published', res.data.status === 'published');

  // POST /boards/:id/duplicate
  res = await api('POST', `/boards/${boardId}/duplicate`, {}, headers);
  test('POST /boards/:id/duplicate', res.status === 201);
  test('Copy hat andere ID', res.data.id !== boardId);

  // DELETE /boards/:id
  res = await api('DELETE', `/boards/${boardId}`, null, headers);
  test('DELETE /boards/:id', res.status === 200);

  // ─────────────────────────────────────────────────
  // Areas Tests
  // ─────────────────────────────────────────────────
  console.log('\n🗺️  Areas Endpoints');

  // POST /areas
  res = await api('POST', '/areas', {
    name: 'Homepage',
    description: 'Startseite',
  }, headers);
  test('POST /areas', res.status === 201);
  test('Area hat ID', res.data.id && res.data.id.length > 5);
  let areaId = res.data.id;

  // GET /areas
  res = await api('GET', '/areas', null, headers);
  test('GET /areas', res.status === 200);
  test('Areas ist Array', Array.isArray(res.data));

  // PUT /areas/:id
  res = await api('PUT', `/areas/${areaId}`, {
    name: 'Blog Homepage',
  }, headers);
  test('PUT /areas/:id', res.status === 200);

  // DELETE /areas/:id
  res = await api('DELETE', `/areas/${areaId}`, null, headers);
  test('DELETE /areas/:id', res.status === 200);

  // ─────────────────────────────────────────────────
  // Settings Tests
  // ─────────────────────────────────────────────────
  console.log('\n⚙️  Settings Endpoints');

  // GET /settings/brand
  res = await api('GET', '/settings/brand', null, headers);
  test('GET /settings/brand', res.status === 200);

  // PUT /settings/brand
  res = await api('PUT', '/settings/brand', {
    websiteUrl: 'https://example.com',
    brandColors: {
      primary: '#2563eb',
      secondary: '#0ea5e9',
    },
  }, headers);
  test('PUT /settings/brand', res.status === 200);

  // ─────────────────────────────────────────────────
  // Embed Tests (Public)
  // ─────────────────────────────────────────────────
  console.log('\n🌐 Embed Endpoints (Public, kein Auth)');

  // GET /embed/channel/:embedKey
  res = await api('GET', '/embed/channel/gc4ea40706q4ji30');
  test('GET /embed/channel/:embedKey', res.status === 200);
  test('Boards Array vorhanden', Array.isArray(res.data.boards));

  // ─────────────────────────────────────────────────
  // Admin Tests
  // ─────────────────────────────────────────────────
  console.log('\n👨‍💼 Admin Endpoints');

  // GET /admin/stats
  res = await api('GET', '/admin/stats', null, headers);
  test('GET /admin/stats', res.status === 200);
  test('Statistiken vorhanden', res.data.totalCustomers >= 0);

  // GET /admin/customers
  res = await api('GET', '/admin/customers', null, headers);
  test('GET /admin/customers', res.status === 200);
  test('Customers Array', Array.isArray(res.data));

  // ─────────────────────────────────────────────────
  // Error Handling Tests
  // ─────────────────────────────────────────────────
  console.log('\n⚠️  Error Handling');

  // Invalid auth token
  res = await api('GET', '/auth/me', null, {
    Authorization: 'Bearer invalid-token',
  });
  test('Reject invalid token', res.status === 401);

  // Missing auth
  res = await api('GET', '/auth/me');
  test('Require auth', res.status === 401);

  // Invalid JSON
  const invalidJsonRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{invalid}',
  });
  const invalidJsonData = await invalidJsonRes.json();
  test('Reject invalid JSON', invalidJsonRes.status === 400);
  test('JSON error message', invalidJsonData.error && invalidJsonData.error.includes('JSON'));

  // ─────────────────────────────────────────────────
  // Results
  // ─────────────────────────────────────────────────
  console.log('\n📊 Test Ergebnisse');
  const passed = testResults.filter(t => t.pass).length;
  const total = testResults.length;
  console.log(`   ${passed}/${total} Tests bestanden`);

  if (passed === total) {
    console.log('\n✅ ALLE TESTS BESTANDEN! Backend ist ready.');
  } else {
    console.log(`\n⚠️  ${total - passed} Tests fehlgeschlagen.`);
  }

  process.exit(passed === total ? 0 : 1);
}

// Run tests
runTests().catch(err => {
  console.error('Test läuft fehl:', err);
  process.exit(1);
});
