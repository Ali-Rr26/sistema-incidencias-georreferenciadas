/**
 * Auth Guard — equivalente a canActivate de Angular.
 *
 * Si no hay token, redirige a /login.
 */
import { auth } from './auth.service.js';

export const authGuard = {
  async canActivate() {
    if (!auth.isAuthenticated()) {
      window.location.hash = '#/login';
      return false;
    }
    return true;
  }
};
