import { router } from './core/router.js';
import { mountLayout, shellInitFn } from './layout/layout.component.js';

import loginComponent from './auth/pages/login/login.component.js';
import dashboardComponent from './dashboard/pages/dashboard/dashboard.component.js';
import incidenciasIndexComponent from './incidencias/pages/index/incidencias.index.component.js';
import incidenciasFormComponent from './incidencias/pages/form/incidencias.form.component.js';
import notFoundComponent from './shared/not-found/not-found.component.js';
import { authGuard } from './auth/auth.guard.js';
import { auth } from './auth/auth.service.js';

import organizacionesComponent from './configuracion/organizaciones/pages/index/organizaciones.index.component.js';
import localizacionesComponent from './configuracion/localizaciones/pages/index/localizaciones.index.component.js';
import categoriasComponent from './configuracion/categorias/pages/index/categorias.index.component.js';
import usuariosComponent from './configuracion/usuarios/pages/index/usuarios.index.component.js';
import feedComponent from './feed/feed.component.js';

router.addRoute('/login',             loginComponent);
router.addRoute('/feed',              feedComponent);
router.addRoute('/dashboard',         dashboardComponent,        [authGuard], true);
router.addRoute('/incidencias',       incidenciasIndexComponent, [authGuard], true);
router.addRoute('/incidencias/crear', incidenciasFormComponent,  [authGuard], true);
router.addRoute('/usuarios',          usuariosComponent,         [authGuard], true);
router.addRoute('/organizaciones',    organizacionesComponent,   [authGuard], true);
router.addRoute('/localizaciones',    localizacionesComponent,   [authGuard], true);
router.addRoute('/categorias',        categoriasComponent,       [authGuard], true);
router.addRoute('/not-found',         notFoundComponent,         [authGuard], true);

router.setShellInitFn(shellInitFn);

(async () => {
  await mountLayout();
  await auth.tryRestoreSession();
  router.init();
})();

window.__router = router;
