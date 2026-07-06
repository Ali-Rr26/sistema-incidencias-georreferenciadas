/**
 * HTTP Service — equivalente a HttpClient + HttpInterceptor de Angular.
 *
 * - Inyecta automáticamente el Bearer token en cada request
 * - Maneja errores 401: intenta refresh con cookie HttpOnly, luego redirige a login
 * - Parsea respuestas JSON
 * - Tokens almacenados en memoria (module-level variables), no en localStorage
 */
import { API_URL } from './config.js';

// Module-level auth state (single source of truth)
let access_token = null;
let session_id = null;
let refreshPromise = null;
let queue = [];

// Exported auth state functions (used by auth.service.js)
export function setAccessToken(token) {
  access_token = token;
}
export function setSessionId(id) {
  session_id = id;
}
export function clearAuthState() {
  access_token = null;
  session_id = null;
}
export function getSessionId() {
  return session_id;
}
export function getAccessToken() {
  return access_token;
}

class HttpService {
  constructor() {
    this.baseUrl = API_URL;
  }

  async request(method, path, body = null) {
    const headers = {};

    if (body && !(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (access_token) {
      headers['Authorization'] = `Bearer ${access_token}`;
    }

    const options = { method, headers, credentials: 'include' };
    if (body) {
      options.body = body instanceof FormData ? body : JSON.stringify(body);
    }

    const res = await fetch(`${this.baseUrl}${path}`, options);

    // 401 → token inválido/expirado, intentar refresh
    if (res.status === 401) {
      return this.handle401({ method, path, body });
    }

    // 204 → sin cuerpo, no intentes parsearlo como JSON
    if (res.status === 204) {
      return null;
    }

    const data = await res.json();

    if (!res.ok) {
      const err = new Error(data.message || 'Error en la solicitud');
      err.status = res.status;
      err.errors = data.errors;
      throw err;
    }

    return data;
  }

  async handle401(originalRequest) {
    if (refreshPromise) {
      // Queue request while refresh is in-flight
      return new Promise((resolve, reject) => {
        queue.push({ resolve, reject, originalRequest });
      });
    }

    // Start refresh
    refreshPromise = this.doRefresh();

    try {
      await refreshPromise;
      // Retry original request
      const result = await this.request(
        originalRequest.method,
        originalRequest.path,
        originalRequest.body,
      );
      // Process any queued requests
      const pendingQueue = [...queue];
      queue = [];
      pendingQueue.forEach(
        ({ resolve, reject, originalRequest: queuedRequest }) => {
          this.request(
            queuedRequest.method,
            queuedRequest.path,
            queuedRequest.body,
          )
            .then(resolve)
            .catch(reject);
        },
      );
      return result;
} catch (err) {
      // Refresh failed. Clear state and notify, but do NOT redirect
      // directly — redirecting mid-shell-init would clear #shell-outlet
      // while the router is still waiting to find #page-outlet, causing
      // "Outlet not found for shell 'app'".
      //
      // Instead, we dispatch a custom event. The router (see app.js)
      // listens for it and redirects only when the shell has finished
      // initializing — see the `auth:expired` listener below.
      clearAuthState();
      window.dispatchEvent(new CustomEvent('auth:expired'));
      // Reject all queued requests
      queue.forEach(({ reject }) =>
        reject(new Error('Sesión expirada. Inicia sesión nuevamente.')),
      );
      queue = [];
      throw err;
    } finally {
      refreshPromise = null;
    }
  }

  async doRefresh() {
    const res = await fetch(`${this.baseUrl}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error('Refresh failed');
    }

    const data = await res.json();
    setAccessToken(data.access_token);
    setSessionId(data.session_id);
    return data;
  }

  get(path) {
    return this.request('GET', path);
  }
  post(path, body) {
    return this.request('POST', path, body);
  }
  put(path, body) {
    return this.request('PUT', path, body);
  }
  delete(path) {
    return this.request('DELETE', path);
  }
}

export const http = new HttpService();
