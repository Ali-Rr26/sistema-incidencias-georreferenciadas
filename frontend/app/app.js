import { router } from './core/router.js';
import { appShell } from './app-shell/app-shell.component.js';

import loginComponent from './auth/pages/login/login.component.js';
import dashboardComponent from './dashboard/pages/dashboard/dashboard.component.js';
import incidenciasIndexComponent from './incidencias/pages/index/incidencias.index.component.js';
import incidenciaFormComponent from './incidencias/pages/form/incidencias.form.component.js';
import incidenciasDetailComponent from './incidencias/pages/detail/incidencias.detail.component.js';
import notFoundComponent from './shared/not-found/not-found.component.js';
import { authGuard } from './auth/auth.guard.js';
import { permissionGuard } from './auth/permission.guard.js';
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
import mapaComponent from './mapa/mapa.component.js';
import mapaCiudadanoComponent from './mapa/mapa-ciudadano.component.js';
import rolesIndexComponent from './configuracion/roles/pages/index/roles.index.component.js';
import rolesDetailComponent from './configuracion/roles/pages/detail/roles.detail.component.js';
import notificacionesIndexComponent from './notificaciones/pages/index/notificaciones.index.component.js';

// ─── Register shell (single, unified) ───────────────────────────────
// Only the unified 'app' shell exists post-consolidar-layout-unico.
router.setShell(appShell);

// ─── Public routes (no shell) ───────────────────────────────────────
// Routes WITHOUT a role tag are full-page (rendered into #auth-outlet).
// Routes WITH a role tag (admin/citizen/both) are mounted into the shell
// and the role is passed to the component's onInit({ role, params, query }).
router.addRoute('/login', loginComponent);

// ─── Citizen routes (authGuard only) ────────────────────────────────
router.addRoute('/feed', feedComponent, [authGuard], 'citizen');
router.addRoute('/feed/crear', incidenciaFormComponent, [authGuard], 'citizen');
router.addRoute('/feed/:id', feedDetailComponent, [authGuard], 'citizen');

// /perfil is reachable from both admin and citizen roles (T-3.1)
router.addRoute('/configuracion/perfil', perfilComponent, [authGuard], 'both');

// ─── Admin routes ───────────────────────────────────────────────────
// All admin routes now go through permissionGuard, which sources
// authorization from menuService.getMyMenu() (single source of truth —
// sidebar menu and route guard share the same data). Previously these
// routes had `guards: []` (no enforcement) or `[roleGuard(['admin_sistema'])]`
// (hardcoded role name); the guard replaces roleGuard on /roles per
// clarifications #2327 and applies to the 13 back-office routes that
// were left unguarded.
router.addRoute('/dashboard', dashboardComponent, [permissionGuard], 'admin');
router.addRoute(
  '/incidencias',
  incidenciasIndexComponent,
  [permissionGuard],
  'admin',
);
router.addRoute(
  '/incidencias/crear',
  incidenciaFormComponent,
  [permissionGuard],
  'admin',
);
router.addRoute(
  '/incidencias/:id',
  incidenciasDetailComponent,
  [permissionGuard],
  'admin',
);
router.addRoute('/mapa', mapaComponent, [permissionGuard], 'admin');
router.addRoute(
  '/mapa-ciudadano',
  mapaCiudadanoComponent,
  [authGuard],
  'citizen',
);
router.addRoute('/usuarios', usuariosComponent, [permissionGuard], 'admin');
router.addRoute(
  '/usuarios/crear',
  usuariosFormComponent,
  [permissionGuard],
  'admin',
);
router.addRoute(
  '/organizaciones',
  organizacionesComponent,
  [permissionGuard],
  'admin',
);
router.addRoute(
  '/organizaciones/crear',
  organizacionesFormComponent,
  [permissionGuard],
  'admin',
);
router.addRoute(
  '/localizaciones',
  localizacionesComponent,
  [permissionGuard],
  'admin',
);
router.addRoute(
  '/localizaciones/crear',
  localizacionesFormComponent,
  [permissionGuard],
  'admin',
);
router.addRoute(
  '/categorias',
  categoriasComponent,
  [permissionGuard],
  'admin',
);
router.addRoute(
  '/categorias/crear',
  categoriasFormComponent,
  [permissionGuard],
  'admin',
);
router.addRoute(
  '/roles',
  rolesIndexComponent,
  [permissionGuard],
  'admin',
);
router.addRoute(
  '/roles/:id',
  rolesDetailComponent,
  [permissionGuard],
  'admin',
);
router.addRoute(
  '/notificaciones',
  notificacionesIndexComponent,
  [authGuard],
  'admin',
);

router.addRoute('/not-found', notFoundComponent, [authGuard], 'both');

// ─── Global listeners (cleaned up if app is ever re-booted in tests) ──
// AbortController: every listener is registered with the controller's signal,
// so a single .abort() detaches all of them. The app module is loaded once
// per page load, so this controller lives for the lifetime of the page.
const appAbort = new AbortController();

document.addEventListener(
  'change',
  (e) => {
    // "Select all" checkbox in admin tables — flips every row in the same
    // table. Kept here (not in a component) because the event delegates from
    // the document; only one handler is needed for the whole app.
    if (e.target.classList.contains('check-select-all')) {
      const table = e.target.closest('table');
      if (table) {
        table.querySelectorAll('.check-row').forEach((cb) => {
          cb.checked = e.target.checked;
        });
      }
    }
  },
  { signal: appAbort.signal },
);

// ─── Boot: restore session, then start router. ─────────────────────
(async () => {
  await auth.tryRestoreSession();
  router.init();
})();
