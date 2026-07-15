/**
 * Complete Load Test Suite - Hito 7
 * Escenarios: smoke, read-heavy, write-heavy, mixed
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { login, authHeaders } from './_auth.js';

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:8000';

// ─── Smoke Test ───────────────────────────────────────────────
export const smokeOptions = {
  vus: 1,
  iterations: 10,
  thresholds: {
    http_req_duration: ['p(95)<200'],
  },
};

export function smokeTest() {
  const token = login(BASE_URL, 'admin@sistema.com', 'Admin123!');
  const headers = authHeaders(token);

  const health = http.get(`${BASE_URL}/api/health`);
  check(health, { 'health: 200': (r) => r.status === 200 });

  const incidents = http.get(`${BASE_URL}/api/incidents?per_page=10`, { headers });
  check(incidents, {
    'list: 200': (r) => r.status === 200,
    'list: has data': (r) => Array.isArray(r.json('data')),
  });

  const categories = http.get(`${BASE_URL}/api/incident-categories`, { headers });
  check(categories, { 'categories: 200': (r) => r.status === 200 });

  const locations = http.get(`${BASE_URL}/api/locations`, { headers });
  check(locations, { 'locations: 200': (r) => r.status === 200 });

  sleep(1);
}

// ─── Read-Heavy Test (50 VUs) ────────────────────────────────
export const readOptions = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 50 },
    { duration: '20s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.05'],
  },
};

export function readTest() {
  const token = login(BASE_URL, 'admin@sistema.com', 'Admin123!');
  const headers = authHeaders(token);

  // Sequential endpoints that map to real usage
  const endpoints = [
    '/api/incidents?per_page=20',
    '/api/incidents?per_page=50&status=pending',
    '/api/incident-categories',
    '/api/locations',
    '/api/incidents/stats',
  ];

  for (const endpoint of endpoints) {
    const res = http.get(`${BASE_URL}${endpoint}`, { headers });
    check(res, { [`read ${endpoint}: 200`]: (r) => r.status === 200 });
  }

  sleep(0.5);
}

// ─── Write-Heavy Test (20 VUs) ────────────────────────────────
export const writeOptions = {
  stages: [
    { duration: '20s', target: 10 },
    { duration: '1m', target: 20 },
    { duration: '20s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.02'],
  },
};

let categoryId = null;
let locationId = null;

export function writeSetup() {
  const token = login(BASE_URL, 'admin@sistema.com', 'Admin123!');
  const headers = authHeaders(token);

  const catRes = http.get(`${BASE_URL}/api/incident-categories/tree`, { headers });
  const cats = catRes.json('data') || [];
  
  for (const cat of cats) {
    if (!cat.children || cat.children.length === 0) {
      categoryId = cat.id;
      break;
    }
  }

  const locRes = http.get(`${BASE_URL}/api/locations/tree`, { headers });
  const locs = locRes.json('data') || [];
  
  for (const loc of locs) {
    if (loc.level === 'city') {
      locationId = loc.id;
      break;
    }
  }

  return { token, categoryId, locationId };
}

export function writeTest(data) {
  const headers = authHeaders(data.token);
  const payload = JSON.stringify({
    title: `[k6-loadtest] carga ${Date.now()}`,
    description: 'Generado por k6 stress test E7',
    priority: 'low',
    incident_category_id: data.categoryId,
    location_id: data.locationId,
    geom: JSON.stringify({
      type: 'Point',
      coordinates: [-78.5 + Math.random(), -0.2 + Math.random()],
    }),
  });

  const res = http.post(`${BASE_URL}/api/incidents`, payload, { headers });
  check(res, { 'create: 201': (r) => r.status === 201 });

  sleep(2);
}

// ─── Mixed Test (25 VUs, 50/50 read/write) ───────────────────
export const mixedOptions = {
  stages: [
    { duration: '30s', target: 15 },
    { duration: '2m', target: 25 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<800'],
    http_req_failed: ['rate<0.03'],
  },
};

export function mixedTest(data) {
  const headers = authHeaders(data.token);

  // Read operations (70%)
  if (Math.random() < 0.7) {
    const res = http.get(`${BASE_URL}/api/incidents?per_page=20`, { headers });
    check(res, { 'read: 200': (r) => r.status === 200 });
  } else {
    // Write operations (30%)
    const payload = JSON.stringify({
      title: `[k6-loadtest] mix ${Date.now()}`,
      description: 'Mixed test',
      priority: 'low',
      incident_category_id: data.categoryId,
      location_id: data.locationId,
    });
    const res = http.post(`${BASE_URL}/api/incidents`, payload, { headers });
    check(res, { 'write: 201': (r) => r.status === 201 });
  }

  sleep(1);
}
