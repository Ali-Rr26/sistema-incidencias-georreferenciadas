/**
 * Layout Usuario — shell minimalista sin sidebar administrativo.
 *
 * Header unificado: muestra "Ingresar" si no hay sesión, o menú hamburguesa
 * con datos del usuario si está autenticado.
 * El contenido del router se monta en #shell-content.
 */
import { defineComponent } from '../utils/component.js';
import { auth } from '../auth/auth.service.js';

let _unsubAuth = null;

function setupHeader() {
  const loginBtn = document.getElementById('lu-btn-login');
  const authDropdown = document.getElementById('lu-dropdown-auth');
  const nameEl = document.getElementById('lu-user-name');
  const avatarEl = document.getElementById('lu-user-avatar');
  const dashboardLink = document.getElementById('lu-dashboard-link');

  if (auth.isAuthenticated()) {
    // Mostrar menú de usuario
    if (loginBtn) loginBtn.style.display = 'none';
    if (authDropdown) authDropdown.classList.remove('d-none');

    // Cargar datos del usuario
    let user = auth.getUser();
    if (user) {
      updateUserInfo(user, nameEl, avatarEl, dashboardLink);
    } else {
      auth.me().then((u) => {
        updateUserInfo(u, nameEl, avatarEl, dashboardLink);
      }).catch(() => {});
    }
  } else {
    // Mostrar botón Ingresar
    if (loginBtn) loginBtn.style.display = '';
    if (authDropdown) authDropdown.classList.add('d-none');
  }
}

function updateUserInfo(user, nameEl, avatarEl, dashboardLink) {
  if (!user) return;

  if (nameEl) {
    nameEl.textContent =
      `${user.first_name || ''} ${user.last_name || ''}`.trim() ||
      user.email ||
      'Usuario';
  }
  if (avatarEl) {
    avatarEl.textContent = (
      user.first_name ||
      user.email ||
      '?'
    )[0].toUpperCase();
  }
  // Ocultar link a panel admin si es rol Usuario
  if (dashboardLink && user?.role?.name === 'usuario') {
    dashboardLink.style.display = 'none';
  }
}

export default defineComponent({
  templateUrl: 'app/layout-usuario/layout-usuario.component.html',

  async onInit() {
    // ── Configurar según estado de auth ──
    setupHeader();

    // ── Escuchar cambios de auth (login/logout) ──
    _unsubAuth = auth.onAuthChange(() => setupHeader());

    // ── Menú hamburguesa toggle ──
    const menuBtn = document.getElementById('lu-menu-btn');
    const dropdown = document.getElementById('lu-dropdown-menu');

    if (menuBtn && dropdown) {
      const toggleMenu = (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('d-none');
      };
      menuBtn.addEventListener('click', toggleMenu);
      this._cleanupMenu = () =>
        menuBtn.removeEventListener('click', toggleMenu);

      // Cerrar al hacer clic fuera
      const closeMenu = () => dropdown.classList.add('d-none');
      document.addEventListener('click', closeMenu);
      this._cleanupDocClick = () =>
        document.removeEventListener('click', closeMenu);
    }

    // ── Cerrar sesión ──
    const logoutBtn = document.getElementById('lu-logout-btn');
    if (logoutBtn) {
      const doLogout = async (e) => {
        e.preventDefault();
        await auth.logout();
        window.location.hash = '#/login';
      };
      logoutBtn.addEventListener('click', doLogout);
      this._cleanupLogout = () =>
        logoutBtn.removeEventListener('click', doLogout);
    }
  },

  onDestroy() {
    if (this._cleanupMenu) this._cleanupMenu();
    if (this._cleanupDocClick) this._cleanupDocClick();
    if (this._cleanupLogout) this._cleanupLogout();
    if (_unsubAuth) _unsubAuth();
  },
});
