import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { getAuthToken } from './_auth.js';

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:8000';

export const options = {
  stages: [
    // Read-heavy: ramp 0→50 VU over 30s, hold 60s, ramp down
    { duration: '30s', target: 50, name: 'read-ramp-up' },
    { duration: '60s', target: 50, name: 'read-plateau' },
    { duration: '30s', target: 0, name: 'read-ramp-down' },
    
    // Write-heavy: ramp 0→20 VU
    { duration: '20s', target: 20, name: 'write-ramp-up' },
    { duration: '60s', target: 20, name: 'write-plateau' },
    { duration: '20s', target: 0, name: 'write-ramp-down' },
    
    // Mixed 70/30
    { duration: '30s', target: 25, name: 'mixed-ramp-up' },
    { duration: '90s', target: 25, name: 'mixed-plateau' },
    { duration: '30s', target: 0, name: 'mixed-ramp-down' },
  ],
  thresholds: {
    'http_req_duration': ['p(95)<800', 'p(99)<1500'],
    'http_req_failed': ['rate<0.05'],
    'checks': ['rate>0.95'],
  },
};

export function setup() {
  const token = getAuthToken(BASE_URL);
  if (!token) {
    throw new Error('Authentication failed during setup');
  }

  return { token };
}

export default function ({ token }) {
  // Read-heavy: 60% incidents, 20% categories, 20% locations
  if (__VU <= 50) {
    const rand = Math.random();
    
    if (rand < 0.6) {
      group('read:incidents', () => {
        const res = http.get(`${BASE_URL}/api/incidents?per_page=20`, {
          headers: { 'Authorization': `Bearer ${token}` },
          tags: { name: 'get_incidents' },
        });
        check(res, {
          'status 200': (r) => r.status === 200,
          'p95 <500ms': (r) => r.timings.duration < 500,
        });
      });
    } else if (rand < 0.8) {
      group('read:categories', () => {
        const res = http.get(`${BASE_URL}/api/incident-categories`, {
          headers: { 'Authorization': `Bearer ${token}` },
          tags: { name: 'get_categories' },
        });
        check(res, {
          'status 200': (r) => r.status === 200,
        });
      });
    } else {
      group('read:locations', () => {
        const res = http.get(`${BASE_URL}/api/locations`, {
          headers: { 'Authorization': `Bearer ${token}` },
          tags: { name: 'get_locations' },
        });
        check(res, {
          'status 200': (r) => r.status === 200,
        });
      });
    }
  }

  // Write-heavy: create incidents (20 VUs, ramp 2-3)
  if (__VU > 50 && __VU <= 70) {
    group('write:create_incident', () => {
      const res = http.post(`${BASE_URL}/api/incidents`, JSON.stringify({
        title: `Test Incident ${__VU}-${Date.now()}`,
        description: 'Load test incident',
        incident_category_id: 2,
        location_id: 1,
        priority: 'medium',
      }), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        tags: { name: 'create_incident' },
      });
      check(res, {
        'status 201': (r) => r.status === 201,
        'p95 <1000ms': (r) => r.timings.duration < 1000,
      });
    });
  }

  // Mixed 70/30
  if (__VU > 70) {
    const rand = Math.random();
    if (rand < 0.7) {
      group('mixed:read', () => {
        const res = http.get(`${BASE_URL}/api/incidents?per_page=20`, {
          headers: { 'Authorization': `Bearer ${token}` },
          tags: { name: 'mixed_read' },
        });
        check(res, {
          'status 200': (r) => r.status === 200,
        });
      });
    } else {
      group('mixed:write', () => {
        const res = http.post(`${BASE_URL}/api/incidents`, JSON.stringify({
          title: `Mixed Incident ${__VU}-${Date.now()}`,
          description: 'Mixed load test',
          incident_category_id: 2,
          location_id: 1,
          priority: 'low',
        }), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          tags: { name: 'mixed_write' },
        });
        check(res, {
          'status 201': (r) => r.status === 201,
        });
      });
    }
  }

  sleep(1);
}
