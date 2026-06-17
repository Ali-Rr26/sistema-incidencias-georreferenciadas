/**
 * Sidebar Component — menú lateral de navegación estilo Freedash.
 * 
 * Uso:
 *   import { sidebarComponent } from './shared/sidebar/sidebar.component.js';
 *   // o inyectar vía _fetchTemplate en el contenedor deseado
 */
import { defineComponent } from '../../utils/component.js';
import { auth } from '../../auth/auth.service.js';

export const sidebarComponent = {
  templateUrl: 'app/shared/sidebar/sidebar.component.html',
  styleUrl:    'app/shared/sidebar/sidebar.component.css',

  async onInit() {
    // Logout desde sidebar
    const logoutBtn = document.getElementById('logout-sidebar');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await auth.logout();
        window.location.hash = '#/login';
      });
    }

    // Re-renderizar Feather icons
    if (window.feather) {
      feather.replace();
    }
  },

  onDestroy() {
    // Sin cleanup necesario
  }
};
