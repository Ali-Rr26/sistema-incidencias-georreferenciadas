/**
 * Dashboard Component — layout principal post-login con estilo Freedash.
 */
import { defineComponent } from '../../../utils/component.js';
import { auth } from '../../../auth/auth.service.js';

export default defineComponent({
  templateUrl: 'app/dashboard/pages/dashboard/dashboard.component.html',
  styleUrl: 'app/dashboard/pages/dashboard/dashboard.component.css',

  async onInit() {
    // Cargar datos del usuario
    try {
      const user = await auth.me();
      const nameEl = document.getElementById('user-name');
      const avatarEl = document.getElementById('user-avatar');
      if (nameEl) nameEl.textContent = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
      if (avatarEl) avatarEl.textContent = (user.first_name || user.email)[0].toUpperCase();
    } catch {
      // fallan los defaults
    }

    // Logout desde navbar
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await auth.logout();
        window.location.hash = '#/login';
      });
    }

    // Logout desde sidebar
    const logoutSidebar = document.getElementById('logout-sidebar');
    if (logoutSidebar) {
      logoutSidebar.addEventListener('click', async () => {
        await auth.logout();
        window.location.hash = '#/login';
      });
    }

    // Re-renderizar Feather icons (se cargan via data-feather attr)
    if (window.feather) {
      feather.replace();
    }
  },

  onDestroy() {
    // Sin cleanup necesario
  }
});
