import http from 'k6/http';
import { check } from 'k6';

/**
 * Logs in once and returns the bearer access_token. Call from setup(),
 * never per-iteration/per-VU — login itself isn't what's under test.
 */
export function login(baseUrl, email, password) {
  const res = http.post(
    `${baseUrl}/api/login`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  check(res, {
    'login: status 200': (r) => r.status === 200,
    'login: got access_token': (r) => !!r.json('access_token'),
  });

  if (res.status !== 200) {
    throw new Error(`login failed: ${res.status} ${res.body}`);
  }

  return res.json('access_token');
}

export function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}
