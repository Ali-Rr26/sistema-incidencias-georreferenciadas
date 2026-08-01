import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { getAuthToken } from './_auth.js';

const BASE_URL = __ENV.API_BASE_URL || 'http://backend:8000';

export const options = {
  scenarios: {
    read_heavy: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 30 },
        { duration: '40s', target: 30 },
        { duration: '20s', target: 0 },
      ],
      exec: 'read',
      tags: { scenario: 'read' },
    },
    write_heavy: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '15s', target: 10 },
        { duration: '40s', target: 10 },
        { duration: '15s', target: 0 },
      ],
      exec: 'write',
      tags: { scenario: 'write' },
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<800', 'p(99)<1500'],
    http_req_failed: ['rate<0.05'],
  },
};

function findLeafCategoryId(nodes) {
  for (const node of nodes) {
    const children = node.children || [];
    if (children.length === 0 && node.organization_id !== null) return node.id;
    const found = findLeafCategoryId(children);
    if (found) return found;
  }
  return null;
}

export function setup() {
  const token = getAuthToken(BASE_URL);
  if (!token) throw new Error('Auth failed');
  const params = { headers: { Authorization: `Bearer ${token}` } };
  const catsRes = http.get(`${BASE_URL}/api/incident-categories/tree`, params);
  const locsRes = http.get(`${BASE_URL}/api/locations?level=city&per_page=1`, params);
  
  const categoryId = findLeafCategoryId(JSON.parse(catsRes.body).data || []);
  const locationId = (JSON.parse(locsRes.body).data || [])[0]?.id ?? null;
  
  if (!categoryId || !locationId) throw new Error('Setup failed');
  return { token, categoryId, locationId };
}

export function read({ token }) {
  const res = http.get(`${BASE_URL}/api/incidents?per_page=20`, {
    headers: { Authorization: `Bearer ${token}` },
    tags: { name: 'get_incidents' },
  });
  check(res, {
    'status 200': (r) => r.status === 200,
    'p95 <500ms': (r) => r.timings.duration < 500,
  });
  sleep(0.5);
}

export function write({ token, categoryId, locationId }) {
  const res = http.post(`${BASE_URL}/api/incidents`, JSON.stringify({
    title: `Test ${Date.now()}`,
    description: 'Load test',
    incident_category_id: categoryId,
    location_id: locationId,
    priority: 'medium',
  }), {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    tags: { name: 'create_incident' },
  });
  check(res, {
    'status 201': (r) => r.status === 201,
    'p95 <1000ms': (r) => r.timings.duration < 1000,
  });
  sleep(0.5);
}
