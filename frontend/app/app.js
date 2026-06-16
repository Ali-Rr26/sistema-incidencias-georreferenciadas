/**
 * App — bootstrap de la SPA.
 * Equivalente a main.ts + AppModule de Angular.
 *
 * 1. Importar módulos/features
 * 2. Registrar rutas con guards
 * 3. Iniciar router
 */
import { router } from './core/router.js';

import loginComponent from './auth/pages/login/login.component.js';
import dashboardComponent from './dashboard/pages/dashboard/dashboard.component.js';
import { authGuard } from './auth/auth.guard.js';

// Registrar rutas
router.addRoute('/login', loginComponent);                    // pública
router.addRoute('/dashboard', dashboardComponent, [authGuard]);   // protegida

// Arrancar
router.init();

// Exponer router global para debug (opcional)
window.__router = router;
