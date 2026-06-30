import { router } from './core/router.js';
import { mountLayout, shellInitFn } from './layout/layout.component.js';

import loginComponent from './auth/pages/login/login.component.js';
import dashboardComponent from './dashboard/pages/dashboard/dashboard.component.js';
import incidenciasIndexComponent from './incidencias/pages/index/incidencias.index.component.js';
import incidenciaCreateComponent from './incidencias/pages/create/incidencia.create.component.js';
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
import feedComponent from './feed/feed.component.js';
import pendientesComponent from './incidencias/pages/pendientes/pendientes.component.js';

// Rutas públicas
router.addRoute('/login', loginComponent);
router.addRoute('/feed', feedComponent);
router.addRoute('/feed/crear', incidenciaCreateComponent, [authGuard], false);

// Rutas protegidas por rol
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

router.addRoute(
  '/dashboard',
  dashboardComponent,
  [roleGuard(allAdminRoles)],
  true,
);
router.addRoute(
  '/incidencias',
  incidenciasIndexComponent,
  [roleGuard(adminOrgRoles)],
  true,
);
router.addRoute(
  '/incidencias/crear',
  incidenciaCreateComponent,
  [roleGuard(adminOrgRoles)],
  true,
);
router.addRoute(
  '/incidencias/:id',
  incidenciasDetailComponent,
  [roleGuard(adminOrgRoles)],
  true,
);
router.addRoute(
  '/incidencias/pendientes',
  pendientesComponent,
  [roleGuard(['publicador'])],
  true,
);

router.addRoute(
  '/usuarios',
  usuariosComponent,
  [roleGuard(adminOnlyRoles)],
  true,
);
router.addRoute(
  '/usuarios/crear',
  usuariosFormComponent,
  [roleGuard(adminOnlyRoles)],
  true,
);
router.addRoute(
  '/organizaciones',
  organizacionesComponent,
  [roleGuard(adminOnlyRoles)],
  true,
);
router.addRoute(
  '/organizaciones/crear',
  organizacionesFormComponent,
  [roleGuard(adminOnlyRoles)],
  true,
);
router.addRoute(
  '/localizaciones',
  localizacionesComponent,
  [roleGuard(adminOnlyRoles)],
  true,
);
router.addRoute(
  '/localizaciones/crear',
  localizacionesFormComponent,
  [roleGuard(adminOnlyRoles)],
  true,
);
router.addRoute(
  '/categorias',
  categoriasComponent,
  [roleGuard(adminOnlyRoles)],
  true,
);
router.addRoute(
  '/categorias/crear',
  categoriasFormComponent,
  [roleGuard(adminOnlyRoles)],
  true,
);
router.addRoute('/not-found', notFoundComponent, [authGuard], true);

router.setShellInitFn(shellInitFn);

(async () => {
  await mountLayout();
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
