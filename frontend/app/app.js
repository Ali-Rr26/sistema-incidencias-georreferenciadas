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
import rolesIndexComponent from './configuracion/roles/pages/index/roles.index.component.js';
import rolesDetailComponent from './configuracion/roles/pages/detail/roles.detail.component.js';

// ─── Register shells ────────────────────────────────────────────────
// PR #3 (consolidar-layout-unico) — final state: only the unified
// 'app' shell is registered. The legacy 'admin' and 'user' shells
// have been deleted (see app/layout/ and app/layout-usuario/ being
// removed in this PR).
router.registerShell('app', appShell);

// ─── Public routes (no shell) ───────────────────────────────────────
router.addRoute('/login', loginComponent);

// ─── Citizen routes (unified app shell, authGuard only) ─────────────
router.addRoute('/feed', feedComponent, [authGuard], 'app', 'citizen');
router.addRoute(
  '/feed/crear',
  incidenciaFormComponent,
  [authGuard],
  'app',
  'citizen',
);
router.addRoute(
  '/feed/:id',
  feedDetailComponent,
  [authGuard],
  'app',
  'citizen',
);

// /perfil is reachable from both admin and citizen shells (T-3.1)
router.addRoute(
  '/configuracion/perfil',
  perfilComponent,
  [authGuard],
  'app',
  'both',
);

// ─── Admin routes (unified app shell, role-guarded) ─────────────────
router.addRoute('/dashboard', dashboardComponent, [], 'app', 'admin');
router.addRoute('/incidencias', incidenciasIndexComponent, [], 'app', 'admin');
router.addRoute(
  '/incidencias/crear',
  incidenciaFormComponent,
  [],
  'app',
  'admin',
);
router.addRoute(
  '/incidencias/:id',
  incidenciasDetailComponent,
  [],
  'app',
  'admin',
);
router.addRoute(
  '/incidencias/pendientes',
  pendientesComponent,
  [],
  'app',
  'admin',
);
router.addRoute('/usuarios', usuariosComponent, [], 'app', 'admin');
router.addRoute('/usuarios/crear', usuariosFormComponent, [], 'app', 'admin');
router.addRoute('/organizaciones', organizacionesComponent, [], 'app', 'admin');
router.addRoute(
  '/organizaciones/crear',
  organizacionesFormComponent,
  [],
  'app',
  'admin',
);
router.addRoute('/localizaciones', localizacionesComponent, [], 'app', 'admin');
router.addRoute(
  '/localizaciones/crear',
  localizacionesFormComponent,
  [],
  'app',
  'admin',
);
router.addRoute('/categorias', categoriasComponent, [], 'app', 'admin');
router.addRoute(
  '/categorias/crear',
  categoriasFormComponent,
  [],
  'app',
  'admin',
);
router.addRoute(
  '/roles',
  rolesIndexComponent,
  [roleGuard(['admin_sistema'])],
  'app',
  'admin',
);
router.addRoute(
  '/roles/:id',
  rolesDetailComponent,
  [roleGuard(['admin_sistema'])],
  'app',
  'admin',
);

router.addRoute('/not-found', notFoundComponent, [authGuard], 'app', 'citizen');

// ─── Role tracking (PR #2 — T-2.5) ─────────────────────────────────
// Keep the router's "current user role" bucket in sync with auth state.
// classifyRole is the single source of truth shared with appShell so the
// router's role check stays consistent with the shell's chrome toggling.
//
// SECURITY: classification never uses a cached user — every call awaits
// a fresh `auth.me()` so role changes / revocations on the backend take
// effect immediately for security decisions.
async function syncCurrentUserRole() {
  const user = await auth.me().catch(() => null);
  router.setCurrentUserRole(classifyRole(user));
}
auth.onAuthChange(() => {
  syncCurrentUserRole();
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

window.__router = router;
