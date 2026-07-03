/**
 * Auth Service — login, logout, refresh, me.
 *
 * - Tokens stored in http.service.js module memory (not localStorage)
 * - Refresh token stored in HttpOnly cookie (managed by backend)
 *
 * SECURITY PRINCIPLE — no cache:
 *   Auth state is **never cached locally**. Every `auth.me()` call hits
 *   `/me` against the backend. `login.user` is for UI hints only and
 *   does NOT contain the `role` field — only `/me` does.
 *
 *   Rationale: Cached role can become stale when the backend changes a
 *   user's role, locks the account, or revokes the session. Security
 *   decisions (route guards, role-mismatch checks, role-driven chrome)
 *   MUST always reflect the current backend state.
 *
 *   Trade-off: every /me call is ~30-80ms over LAN. Acceptable for the
 *   security guarantee.
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
    this._authChangeCallbacks = [];
    // No _cachedUser. Always-on /me for role + identity.
  }

  async login(email, password) {
    const data = await http.post('/login', { email, password });
    setAccessToken(data.access_token);
    setSessionId(data.session_id);
    // Notify subscribers (router role tracker, appShell header) that
    // auth state has changed. Without this call, the router stays in
    // 'guest' and the appShell never gets the new role/avatar.
    this._notifyAuthChange();
    return data;
  }

  async logout() {
    try {
      await http.post('/logout', { _session_id: getSessionId() });
    } catch {
      // Clear state even if server call fails
    }
    clearAuthState();
    this._notifyAuthChange();
  }

  /**
   * Fetch current user from backend. ALWAYS hits /me.
   * Never cached — see SECURITY PRINCIPLE above.
   */
  async me() {
    const data = await http.get('/me');
    return data.data || data;
  }

  /**
   * Synchronous getter removed. Always use `await auth.me()` instead.
   * Returning null forces callers to make their code async and to
   * fetch fresh state instead of trusting a cached user object.
   */
  getUser() {
    return null;
  }

  isAuthenticated() {
    return !!getAccessToken();
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
}

export const auth = new AuthService();
