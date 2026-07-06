# 07 — Consolidación de shells (deuda técnica)

**Tipo:** Deuda técnica
**Severidad:** 🟡 Baja (sin impacto funcional)
**Backend:** — · **Frontend:** ⚠️ Consolidación incompleta

## Problema

El commit #43 (`refactor(frontend): consolidate admin + user shells into single
responsive appShell`) anuncia un shell único responsivo. En la práctica, el código
sigue registrando **dos shells separados**:

```js
// frontend/app/app.js
router.registerShell('admin', adminShell);   // ./layout/layout.component.js
router.registerShell('user', userShell);     // ./layout-usuario/layout-usuario.component.js
```

El "appShell único" solo existe como:
- artefacto viejo en `frontend/coverage/` (reporte de cobertura obsoleto),
- referencias en refs de branch (`fix/consolidar-layout-pr1-app-shell`).

El nombre de la rama (`pr1`) sugiere un esfuerzo multi-PR que quedó a mitad.

## Estado actual

- `frontend/app/layout/layout.component.js` — `adminShell` (navbar + sidebar).
- `frontend/app/layout-usuario/layout-usuario.component.js` — `userShell`
  (estilo Instagram: top bar + sidebar desktop, bottom nav mobile).
- Ambos con lógica de nav duplicada (`updateAdminNavActive` / `updateUserNavActive`,
  dos plantillas HTML, dos sets de links).
- Shims deprecados aún presentes: `mountLayout()`, `shellInitFn()`, `setShellInitFn()`.

## Alcance

- [ ] Decidir si se completa la consolidación a un `appShell` responsivo único o
      se mantienen dos shells por diseño.
- [ ] Si se consolida:
  - Unificar `layout` + `layout-usuario` en un shell responsivo por breakpoint/rol.
  - Migrar `app.js` a registrar un solo shell.
  - Eliminar plantillas y lógica de nav duplicadas.
- [ ] Eliminar shims deprecados (`mountLayout`, `shellInitFn`, `setShellInitFn`)
      una vez sin usos.
- [ ] Limpiar `frontend/coverage/` del control de versiones si está trackeado
      (verificar `.gitignore`).
- [ ] Alinear el mensaje/estado: el refactor #43 no debería figurar como completo
      si aún hay dos shells.

## Dependencia

Coordinar con [doc 01](01-menu-dinamico.md): si el menú pasa a dinámico, la
consolidación de shells es el momento natural para unificar la navegación.

## Criterios de aceptación

- Una sola fuente de layout, o dos claramente justificadas y documentadas.
- Sin lógica de navegación duplicada.
- Sin shims deprecados sin uso.
- `coverage/` fuera del repo.

## Archivos afectados

- `frontend/app/app.js`
- `frontend/app/layout/**`
- `frontend/app/layout-usuario/**`
- `frontend/app/core/router.js` (limpieza de compat legacy)
- `.gitignore`
