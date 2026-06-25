import { initShell } from '../utils/layout.js';
import { auth } from '../auth/auth.service.js';
import { router } from '../core/router.js';

const TEMPLATE_URL = 'app/layout/layout.component.html';

/**
 * mountLayout — fetches the app shell template and injects it into #shell-outlet.
 * Must be called before router.init() so #page-outlet exists in the DOM.
 */
export async function mountLayout() {
  const response = await fetch(TEMPLATE_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load layout template: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const outlet = document.getElementById('shell-outlet');
  if (!outlet) {
    throw new Error('mountLayout: #shell-outlet not found in DOM');
  }

  outlet.innerHTML = html;
  initShell();
}

/**
 * shellInitFn — paints user data and wires logout handlers once the shell is shown.
 * Called by the router after the first authenticated route is activated.
 */
export async function shellInitFn() {
  try {
    const user = await auth.me();
    const nameEl = document.getElementById('user-name');
    const avatarEl = document.getElementById('user-avatar');
    if (nameEl) nameEl.textContent = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
    if (avatarEl) avatarEl.textContent = (user.first_name || user.email)[0].toUpperCase();
  } catch { /* keep defaults */ }

  const logout = async () => {
    await auth.logout();
    router.resetShell();
    window.location.hash = '#/login';
  };

  document.getElementById('logout-btn')?.addEventListener('click', e => { e.preventDefault(); logout(); });
  document.getElementById('logout-sidebar')?.addEventListener('click', logout);
}
