import http from 'k6/http';
import { check, sleep } from 'k6';
import { login, authHeaders } from './_auth.js';

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:8000';

export const options = {
  vus: 1,
  iterations: 5,
};

export function setup() {
  const token = login(BASE_URL, 'admin@sistema.com', 'Admin123!');
  return { token };
}

export default function (data) {
  const health = http.get(`${BASE_URL}/api/health`);
  check(health, { 'health: status 200': (r) => r.status === 200 });

  const incidents = http.get(`${BASE_URL}/api/incidents?per_page=5`, {
    headers: authHeaders(data.token),
  });
  check(incidents, {
    'incidents: status 200': (r) => r.status === 200,
    'incidents: has data array': (r) => Array.isArray(r.json('data')),
  });

  sleep(1);
}
