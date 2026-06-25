import { router } from './core/router.js';

import loginComponent from './auth/pages/login/login.component.js';
import dashboardComponent from './dashboard/pages/dashboard/dashboard.component.js';
import incidenciasIndexComponent from './incidencias/pages/index/incidencias.index.component.js';
import incidenciasFormComponent from './incidencias/pages/form/incidencias.form.component.js';
import notFoundComponent from './shared/not-found/not-found.component.js';
import { authGuard } from './auth/auth.guard.js';
import { auth } from './auth/auth.service.js';

router.addRoute('/login',              loginComponent);
router.addRoute('/dashboard',          dashboardComponent,         [authGuard]);
router.addRoute('/incidencias',        incidenciasIndexComponent,  [authGuard]);
router.addRoute('/incidencias/crear',  incidenciasFormComponent,   [authGuard]);
router.addRoute('/not-found',          notFoundComponent,          [authGuard]);

(async () => {
  await auth.tryRestoreSession();
  router.init();
})();

window.__router = router;
