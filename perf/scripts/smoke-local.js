import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.API_BASE_URL || 'http://host.docker.internal:8000';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<300'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/api/health`, {
    tags: { name: 'health' },
  });
  
  check(res, {
    'status 200': (r) => r.status === 200,
    'has status field': (r) => r.body.includes('status'),
  });
  
  sleep(1);
}
