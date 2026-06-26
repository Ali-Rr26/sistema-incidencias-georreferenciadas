/**
 * Auth Service — login, logout, refresh, me.
 *
 * - Tokens stored in http.service.js module memory (not localStorage)
 * - Refresh token stored in HttpOnly cookie (managed by backend)
 * - Logout sends session_id for revocation
 */
import {
  http,
  setAccessToken,
  setSessionId,
  clearAuthState,
  getSessionId,
  getAccessToken,
} from '../core/http.service.js';

class AuthService {
  async login(email, password) {
    const data = await http.post('/login', { email, password });
    setAccessToken(data.access_token);
    setSessionId(data.session_id);
    return data;
  }

  async logout() {
    try {
      await http.post('/logout', { _session_id: getSessionId() });
    } catch {
      // Clear state even if server call fails
    }
    clearAuthState();
    window.location.hash = '#/login';
  }

  async me() {
    return await http.get('/me');
  }

  async tryRestoreSession() {
    try {
      const data = await http.post('/auth/refresh');
      setAccessToken(data.access_token);
    } catch {
      // No valid refresh cookie — user must log in
    }
  }

  isAuthenticated() {
    return !!getAccessToken();
  }
}

export const auth = new AuthService();
