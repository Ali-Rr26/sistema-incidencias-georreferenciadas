# Pendientes de implementación

Backlog de inconsistencias y funcionalidades faltantes detectadas en la auditoría
de rutas, componentes y endpoints (frontend SPA + backend Laravel).

Cada documento es una unidad de trabajo independiente con contexto, estado actual,
alcance y criterios de aceptación.

## Prioridad

| # | Documento | Tipo | Severidad | Estado backend | Estado frontend |
|---|-----------|------|-----------|----------------|-----------------|
| 01 | [Menú dinámico](01-menu-dinamico.md) | Integración | 🔴 Alta | ✅ Implementado | ❌ Hardcodeado |
| 02 | [Rutas fantasma (reportes / mapa)](02-rutas-fantasma.md) | Bug UX | 🔴 Alta | — | ❌ Links a 404 |
| 03 | [Notificaciones](03-notificaciones.md) | Feature | 🟠 Media | ⚠️ Stub | ❌ Ausente |
| 04 | [Guard de `/feed/:id`](04-feed-detail-guard.md) | Seguridad | 🟡 Revisar | — | ⚠️ Sin guard |
| 05 | [Permisos (CRUD)](05-permisos.md) | Feature | 🟠 Media | ⚠️ Stub | ❌ Ausente |
| 06 | [Asignaciones](06-asignaciones.md) | Feature | 🟠 Media | ⚠️ Stub | ❌ Ausente |
| 07 | [Consolidación de shells](07-consolidacion-shells.md) | Deuda técnica | 🟡 Baja | — | ⚠️ Incompleto |

## Leyenda

- ✅ Implementado y funcional
- ⚠️ Existe pero es stub / incompleto
- ❌ No existe

## Orden sugerido de ataque

1. **02** — links rotos visibles al usuario (rápido: ocultar o implementar).
2. **04** — decisión de seguridad, cero código si se confirma intencional.
3. **01** — conectar el menú dinámico ya existente (elimina duplicación).
4. **03 / 05 / 06** — features con backend stub; requieren backend + frontend completos.
5. **07** — limpieza de deuda técnica, sin impacto funcional.
