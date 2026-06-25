import { defineComponent } from '../../utils/component.js';
import { auth } from '../../auth/auth.service.js';

export default defineComponent({
  templateUrl: 'app/shared/not-found/not-found.component.html',

  async onInit() {
    try {
      const user = await auth.me();
      const nameEl = document.getElementById('user-name');
      const avatarEl = document.getElementById('user-avatar');
      if (nameEl) nameEl.textContent = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
      if (avatarEl) avatarEl.textContent = (user.first_name || user.email)[0].toUpperCase();
    } catch { /* defaults */ }

    document.getElementById('logout-btn')?.addEventListener('click', async (e) => {
      e.preventDefault();
      await auth.logout();
      window.location.hash = '#/login';
    });
    document.getElementById('logout-sidebar')?.addEventListener('click', async () => {
      await auth.logout();
      window.location.hash = '#/login';
    });

    if (window.feather) feather.replace();
  },

  onDestroy() {}
});
