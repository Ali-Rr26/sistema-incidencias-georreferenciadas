import { router } from './core/router.js';
import { appShell, classifyRole } from './app-shell/app-shell.component.js';

import loginComponent from './auth/pages/login/login.component.js';
import dashboardComponent from './dashboard/pages/dashboard/dashboard.component.js';
import incidenciasIndexComponent from './incidencias/pages/index/incidencias.index.component.js';
import incidenciaFormComponent from './incidencias/pages/form/incidencias.form.component.js';
import incidenciasDetailComponent from './incidencias/pages/detail/incidencias.detail.component.js';
import notFoundComponent from './shared/not-found/not-found.component.js';
import { authGuard } from './auth/auth.guard.js';
import { roleGuard } from './auth/role.guard.js';
import { auth } from './auth/auth.service.js';

import organizacionesComponent from './configuracion/organizaciones/pages/index/organizaciones.index.component.js';
import organizacionesFormComponent from './configuracion/organizaciones/pages/form/organizaciones.form.component.js';
import localizacionesComponent from './configuracion/localizaciones/pages/index/localizaciones.index.component.js';
import localizacionesFormComponent from './configuracion/localizaciones/pages/form/localizaciones.form.component.js';
import categoriasComponent from './configuracion/categorias/pages/index/categorias.index.component.js';
import categoriasFormComponent from './configuracion/categorias/pages/form/categorias.form.component.js';
import usuariosComponent from './configuracion/usuarios/pages/index/usuarios.index.component.js';
import usuariosFormComponent from './configuracion/usuarios/pages/form/usuarios.form.component.js';
import perfilComponent from './configuracion/perfil/perfil.component.js';
import feedComponent from './feed/feed.component.js';
import feedDetailComponent from './feed/pages/detail/feed-detail.component.js';
import pendientesComponent from './incidencias/pages/pendientes/pendientes.component.js';
import mapaComponent from './mapa/mapa.component.js';
import mapaCiudadanoComponent from './mapa/mapa-ciudadano.component.js';
import rolesIndexComponent from './configuracion/roles/pages/index/roles.index.component.js';
import rolesDetailComponent from './configuracion/roles/pages/detail/roles.detail.component.js';
import notificacionesIndexComponent from './notificaciones/pages/index/notificaciones.index.component.js';

// ─── Register shell (single, unified) ───────────────────────────────
// Only the unified 'app' shell exists post-consolidar-layout-unico.
router.setShell(appShell);

// ─── Public routes (no shell) ───────────────────────────────────────
router.addRoute('/login', loginComponent);

// ─── Citizen routes (authGuard only) ────────────────────────────────
router.addRoute('/feed', feedComponent, [authGuard], 'citizen');
router.addRoute('/feed/crear', incidenciaFormComponent, [authGuard], 'citizen');
router.addRoute('/feed/:id', feedDetailComponent, [authGuard], 'citizen');

// /perfil is reachable from both admin and citizen roles (T-3.1)
router.addRoute('/configuracion/perfil', perfilComponent, [authGuard], 'both');

// ─── Admin routes ───────────────────────────────────────────────────
router.addRoute('/dashboard', dashboardComponent, [], 'admin');
router.addRoute('/incidencias', incidenciasIndexComponent, [], 'admin');
router.addRoute('/incidencias/crear', incidenciaFormComponent, [], 'admin');
router.addRoute('/incidencias/:id', incidenciasDetailComponent, [], 'admin');
router.addRoute('/incidencias/pendientes', pendientesComponent, [], 'admin');
router.addRoute('/mapa', mapaComponent, [], 'admin');
router.addRoute(
  '/mapa-ciudadano',
  mapaCiudadanoComponent,
  [authGuard],
  'citizen',
);
router.addRoute('/usuarios', usuariosComponent, [], 'admin');
router.addRoute('/usuarios/crear', usuariosFormComponent, [], 'admin');
router.addRoute('/organizaciones', organizacionesComponent, [], 'admin');
router.addRoute(
  '/organizaciones/crear',
  organizacionesFormComponent,
  [],
  'admin',
);
router.addRoute('/localizaciones', localizacionesComponent, [], 'admin');
router.addRoute(
  '/localizaciones/crear',
  localizacionesFormComponent,
  [],
  'admin',
);
router.addRoute('/categorias', categoriasComponent, [], 'admin');
router.addRoute('/categorias/crear', categoriasFormComponent, [], 'admin');
router.addRoute(
  '/roles',
  rolesIndexComponent,
  [roleGuard(['admin_sistema'])],
  'admin',
);
router.addRoute(
  '/roles/:id',
  rolesDetailComponent,
  [roleGuard(['admin_sistema'])],
  'admin',
);
router.addRoute(
  '/notificaciones',
  notificacionesIndexComponent,
  [authGuard],
  'admin',
);

router.addRoute('/not-found', notFoundComponent, [authGuard], 'both');

let _pendingRoleSync = Promise.resolve();
export function pendingRoleSync() {
  return _pendingRoleSync;
}
async function syncCurrentUserRole() {
  const user = await auth.me().catch(() => null);
  router.setCurrentUserRole(classifyRole(user));
}
auth.onAuthChange(() => {
  // Track the in-flight sync so callers can await it via
  // pendingRoleSync() when they need a deterministic role pre-navigation.
  _pendingRoleSync = syncCurrentUserRole();
});
syncCurrentUserRole();

// ─── Boot: restore session, then start router. Router mounts shells on demand. ───
(async () => {
  await auth.tryRestoreSession();
  // Re-sync after the session restore (token may now be set).
  await syncCurrentUserRole();
  router.init();
})();

document.addEventListener('change', (e) => {
  if (e.target.classList.contains('check-select-all')) {
    const table = e.target.closest('table');
    if (table) {
      table.querySelectorAll('.check-row').forEach((cb) => {
        cb.checked = e.target.checked;
      });
    }
  }
});

// ─── auth:expired listener ──────────────────────────────────────────────────
// http.service.js dispatches this event when a 401 cannot be recovered via
// refresh. We translate that into a redirect to /login — but only AFTER the
// router's shell has finished initializing. Redirecting during shell init
// would clear #shell-outlet mid-mount and break the router's outlet lookup.
window.addEventListener('auth:expired', () => {
  // http.service.js dispatches this event when a 401 cannot be recovered via
  // refresh. We translate that into a redirect to /login.
  if (window.location.hash !== '#/login') {
    window.location.hash = '#/login';
  }
});

window.__router = router;
