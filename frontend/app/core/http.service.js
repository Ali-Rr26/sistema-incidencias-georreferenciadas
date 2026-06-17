/**
 * HTTP Service — equivalente a HttpClient + HttpInterceptor de Angular.
 *
 * - Inyecta automáticamente el Bearer token en cada request
 * - Maneja errores 401: redirige a login
 * - Parsea respuestas JSON
 */
import { API_URL } from './config.js';

class HttpService {
  constructor() {
    this.baseUrl = API_URL;
  }

  async request(method, path, body = null) {
    const token = localStorage.getItem('access_token');
    const headers = {};

    if (body && !(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options = { method, headers };
    if (body) {
      options.body = body instanceof FormData ? body : JSON.stringify(body);
    }

    const res = await fetch(`${this.baseUrl}${path}`, options);

    // 401 → token inválido/expirado, redirigir a login
    if (res.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.hash = '#/login';
      throw new Error('Sesión expirada. Inicia sesión nuevamente.');
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

  get(path)       { return this.request('GET', path); }
  post(path, body) { return this.request('POST', path, body); }
  put(path, body)  { return this.request('PUT', path, body); }
  delete(path)     { return this.request('DELETE', path); }
}

export const http = new HttpService();
