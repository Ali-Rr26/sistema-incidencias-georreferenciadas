import { router } from './core/router.js';
import { mountLayout, shellInitFn } from './layout/layout.component.js';

import loginComponent from './auth/pages/login/login.component.js';
import dashboardComponent from './dashboard/pages/dashboard/dashboard.component.js';
import incidenciasIndexComponent from './incidencias/pages/index/incidencias.index.component.js';
import incidenciasFormComponent from './incidencias/pages/form/incidencias.form.component.js';
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
import feedCreateComponent from './feed-create/feed-create.component.js';
import feedDetailComponent from './incidencias/pages/detail/feed-detail.component.js';
import layoutUsuario from './layout-usuario/layout-usuario.component.js';

// ── Register custom layouts ──
router.registerLayout('usuario', layoutUsuario);

// ── Admin roles (hoisted before any route that uses roleGuard) ──
const adminRoles = [
  'admin_sistema',
  'Admin',
  'admin_organizacion',
  'operador_sistema',
  'operador_organizacion',
];

// ── Public routes (full-page, no shell) ──
router.addRoute('/login', loginComponent);

// ── Feed: dual-mode (public header or auth header) ──
router.addRoute('/feed', feedComponent, [], 'usuario');

// ── Feed create: protected, usuario layout ──
router.addRoute(
  '/feed/crear',
  feedCreateComponent,
  [authGuard],
  'usuario',
);

// ── Feed detail: citizen view (usuario layout, no roleGuard) ──
router.addRoute(
  '/feed/:id',
  feedDetailComponent,
  [],
  'usuario',
);

// ── Feed admin: protected, admin shell (desktop mode) ──
router.addRoute(
  '/incidencias/feed',
  feedComponent,
  [authGuard, roleGuard(adminRoles)],
  true,
);

// ── Feed detail: admin view (admin shell, roleGuard) ──
router.addRoute(
  '/incidencias/:id',
  feedDetailComponent,
  [authGuard, roleGuard(adminRoles)],
  true,
);

// ── Admin routes (protected with roleGuard, admin shell) ──

router.addRoute(
  '/dashboard',
  dashboardComponent,
  [authGuard, roleGuard(adminRoles)],
  true,
);
router.addRoute(
  '/incidencias',
  incidenciasIndexComponent,
  [authGuard, roleGuard(adminRoles)],
  true,
);
router.addRoute(
  '/incidencias/crear',
  incidenciasFormComponent,
  [authGuard, roleGuard(adminRoles)],
  true,
);
router.addRoute(
  '/usuarios',
  usuariosComponent,
  [authGuard, roleGuard(adminRoles)],
  true,
);
router.addRoute(
  '/usuarios/crear',
  usuariosFormComponent,
  [authGuard, roleGuard(adminRoles)],
  true,
);
router.addRoute(
  '/organizaciones',
  organizacionesComponent,
  [authGuard, roleGuard(adminRoles)],
  true,
);
router.addRoute(
  '/organizaciones/crear',
  organizacionesFormComponent,
  [authGuard, roleGuard(adminRoles)],
  true,
);
router.addRoute(
  '/localizaciones',
  localizacionesComponent,
  [authGuard, roleGuard(adminRoles)],
  true,
);
router.addRoute(
  '/localizaciones/crear',
  localizacionesFormComponent,
  [authGuard, roleGuard(adminRoles)],
  true,
);
router.addRoute(
  '/categorias',
  categoriasComponent,
  [authGuard, roleGuard(adminRoles)],
  true,
);
router.addRoute(
  '/categorias/crear',
  categoriasFormComponent,
  [authGuard, roleGuard(adminRoles)],
  true,
);
router.addRoute(
  '/not-found',
  notFoundComponent,
  [authGuard],
  true,
);

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
