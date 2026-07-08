# Pendientes de implementación

Backlog de inconsistencias y funcionalidades faltantes detectadas en la auditoría
de rutas, componentes y endpoints (frontend SPA + backend Laravel).

Cada documento es una unidad de trabajo independiente con contexto, estado actual,
alcance y criterios de aceptación.

## Prioridad

| # | Documento | Tipo | Severidad | Estado backend | Estado frontend |
| --- | ----------- | ------ | ----------- | ---------------- | ----------------- |
| 01 | [Menú dinámico](01-menu-dinamico.md) | Integración | 🔴 Alta | ✅ Implementado | ✅ Migrado a `/menus/my` |
| 02 | [Rutas fantasma (reportes / mapa)](02-rutas-fantasma.md) | Bug UX | 🔴 Alta | — | ⚠️ Parcial (Notificaciones OK) |
| 03 | [Notificaciones](03-notificaciones.md) | Feature | 🟠 Media | ✅ Modelo + controller + observer | ✅ UI con badge dinámico |
| 04 | [Guard de `/feed/:id`](04-feed-detail-guard.md) | Seguridad | 🟡 Revisar | — | ✅ `authGuard` aplicado |
| 05 | [Permisos (CRUD)](05-permisos.md) | Feature | 🟠 Media | ✅ CRUD borrado + `role_permission` sync | ✅ UI de roles con checklist |
| 06 | [Asignaciones](06-asignaciones.md) | Feature | 🟠 Media | ✅ Stack zombie borrado + drop migration | ✅ N/A (no aplica) |
| 07 | [Consolidación de shells](07-consolidacion-shells.md) | Deuda técnica | 🟡 Baja | — | ✅ **Completado por PR #43** |

## Leyenda

- ✅ Implementado y funcional
- ⚠️ Existe pero es stub / incompleto
- ❌ No existe

## Estado del backlog (2026-07-05)

Los 7 ítems del backlog original fueron trabajados en una sola sesión. Estado:

- ✅ **01** — Menú dinámico migrado al shell admin (consume `GET /menus/my`).
- ⚠️ **02** — Parcial: las rutas fantasma en el sidebar admin ya no rompen
  porque el menú es dinámico. Faltan las del sidebar citizen (`/mapa`,
  `/alertas` siguen como placeholders). Queda para una iteración futura.
- ✅ **03** — Notificaciones implementadas (backend completo + UI con badge).
- ✅ **04** — `authGuard` agregado a `/feed/:id`.
- ✅ **05** — CRUD de permissions borrado; CRUD de roles + asignación de
  permisos por UI implementado en su lugar.
- ✅ **06** — Stack de assignments borrado (era zombie); nueva migración
  `drop_assignments_table` para limpiar la tabla huérfana.
- ✅ **07** — Ya estaba completado por el PR #43 antes de iniciar este
  backlog. Doc cerrado sin acción.

## Próximas iteraciones sugeridas

1. Limpiar las rutas fantasma del sidebar citizen (`/mapa`, `/alertas`).
2. Implementar la vista de mapa georreferenciado (mención histórica del doc 02).
3. Revisar si el sidebar citizen debe migrar al menú dinámico (hoy sigue
   estático).
