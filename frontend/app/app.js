import { router } from './core/router.js';
import { adminShell } from './layout/layout.component.js';
import { userShell } from './layout-usuario/layout-usuario.component.js';

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

// ─── Register shells ────────────────────────────────────────────────
router.registerShell('admin', adminShell);
router.registerShell('user', userShell);

// ─── Role definitions ───────────────────────────────────────────────
const adminOrgRoles = [
  'admin_sistema',
  'admin_organizacion',
  'operador_organizacion',
];
const adminOnlyRoles = ['admin_sistema', 'admin_organizacion'];
const allAdminRoles = [
  'admin_sistema',
  'admin_organizacion',
  'operador_organizacion',
  'publicador',
];

// ─── Public routes (no shell) ───────────────────────────────────────
router.addRoute('/login', loginComponent);

// ─── Citizen routes (user shell, authGuard only — accessible to all roles) ─
router.addRoute('/feed', feedComponent, [authGuard], 'user');
router.addRoute('/feed/crear', incidenciaFormComponent, [authGuard], 'user');
router.addRoute('/feed/:id', feedDetailComponent, [], 'user');
router.addRoute('/configuracion/perfil', perfilComponent, [authGuard], 'user');

// ─── Admin routes (admin shell, role-guarded) ───────────────────────
router.addRoute(
  '/dashboard',
  dashboardComponent,
  [roleGuard(allAdminRoles)],
  'admin',
);
router.addRoute(
  '/incidencias',
  incidenciasIndexComponent,
  [roleGuard(adminOrgRoles)],
  'admin',
);
router.addRoute(
  '/incidencias/crear',
  incidenciaFormComponent,
  [roleGuard(adminOrgRoles)],
  'admin',
);
router.addRoute(
  '/incidencias/:id',
  incidenciasDetailComponent,
  [roleGuard(adminOrgRoles)],
  'admin',
);
router.addRoute(
  '/incidencias/pendientes',
  pendientesComponent,
  [roleGuard(['publicador'])],
  'admin',
);

router.addRoute(
  '/usuarios',
  usuariosComponent,
  [roleGuard(adminOnlyRoles)],
  'admin',
);
router.addRoute(
  '/usuarios/crear',
  usuariosFormComponent,
  [roleGuard(adminOnlyRoles)],
  'admin',
);
router.addRoute(
  '/organizaciones',
  organizacionesComponent,
  [roleGuard(adminOnlyRoles)],
  'admin',
);
router.addRoute(
  '/organizaciones/crear',
  organizacionesFormComponent,
  [roleGuard(adminOnlyRoles)],
  'admin',
);
router.addRoute(
  '/localizaciones',
  localizacionesComponent,
  [roleGuard(adminOnlyRoles)],
  'admin',
);
router.addRoute(
  '/localizaciones/crear',
  localizacionesFormComponent,
  [roleGuard(adminOnlyRoles)],
  'admin',
);
router.addRoute(
  '/categorias',
  categoriasComponent,
  [roleGuard(adminOnlyRoles)],
  'admin',
);
router.addRoute(
  '/categorias/crear',
  categoriasFormComponent,
  [roleGuard(adminOnlyRoles)],
  'admin',
);

router.addRoute('/not-found', notFoundComponent, [authGuard], 'user');

// ─── Boot: restore session, then start router. Router mounts shells on demand. ───
(async () => {
  await auth.tryRestoreSession();
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