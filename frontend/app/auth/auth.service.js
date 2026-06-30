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
  constructor() {
    this._cachedUser = null;
    this._authChangeCallbacks = [];
  }

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
    this._cachedUser = null;
    this._notifyAuthChange();
  }

  async me(forceRefresh = false) {
    if (this._cachedUser && !forceRefresh) {
      return this._cachedUser;
    }
    const data = await http.get('/me');
    this._cachedUser = data.data || data;
    return this._cachedUser;
  }

  getUser() {
    return this._cachedUser;
  }

  /** Subscribe to auth state changes. Returns an unsubscribe function. */
  onAuthChange(callback) {
    this._authChangeCallbacks.push(callback);
    return () => {
      const idx = this._authChangeCallbacks.indexOf(callback);
      if (idx >= 0) this._authChangeCallbacks.splice(idx, 1);
    };
  }

  _notifyAuthChange() {
    this._authChangeCallbacks.forEach((cb) => cb());
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
