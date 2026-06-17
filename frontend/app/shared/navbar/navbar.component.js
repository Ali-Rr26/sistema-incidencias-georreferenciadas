/**
 * Navbar Component — barra superior con dropdown de usuario.
 */
import { defineComponent } from '../../utils/component.js';
import { auth } from '../../auth/auth.service.js';

export const navbarComponent = {
  templateUrl: 'app/shared/navbar/navbar.component.html',
  styleUrl:    'app/shared/navbar/navbar.component.css',

  async onInit() {
    // Cargar datos del usuario
    try {
      const user = await auth.me();
      const nameEl = document.getElementById('user-name');
      const avatarEl = document.getElementById('user-avatar');
      if (nameEl) nameEl.textContent = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
      if (avatarEl) avatarEl.textContent = (user.first_name || user.email)[0].toUpperCase();
    } catch {
      // Si falla, mostramos valores por defecto
    }

    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await auth.logout();
        window.location.hash = '#/login';
      });
    }
  },

  onDestroy() {
    // Sin cleanup necesario
  }
};
