/**
 * Auth Service — login, logout, refresh, me.
 */
import { http } from '../core/http.service.js';

class AuthService {
  async login(email, password) {
    const data = await http.post('/login', { email, password });
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    return data;
  }

  async logout() {
    try {
      await http.post('/logout');
    } catch (err) {
      // Aunque falle en el server, limpiamos local
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  async me() {
    return await http.get('/me');
  }

  isAuthenticated() {
    return !!localStorage.getItem('access_token');
  }
}

export const auth = new AuthService();
