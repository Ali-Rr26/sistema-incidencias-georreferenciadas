# Módulo 08 — Dashboard y Métricas

**Requisitos SRS:** RF-FUNC-021, RF-FUNC-022, RF-FUNC-023, RF-SW-009, RF-UI-002
**Casos de prueba:** CP-08-01 a CP-08-12 (12 casos)

---

### RF-FUNC-021_CP-08-01-F: Tarjeta principal muestra total de incidencias

- **Requisito:** RF-FUNC-021 — Métricas Generales
- **Prueba:** CP-08-01-F
- **Capa:** Frontend (F) | **Responsable:** Integrante 1
- **Descripción:** Ir a dashboard, observar tarjeta superior.
- **Criterio:** "Total de Incidencias: 150" (número actualizado).
- **Estado:** ☑ Completado | **Implementación:** dashboard.component.js — animateCounter() (lines 32-46) updates `#stat-incidencias` with animated counter from API response

---

### RF-FUNC-021_CP-08-01-B: Endpoint retorna métricas generales agregadas

- **Requisito:** RF-FUNC-021 — Métricas Generales
- **Prueba:** CP-08-01-B
- **Capa:** Backend (B) | **Responsable:** Integrante 2
- **Descripción:** GET /api/metricas/generales.
- **Criterio:** JSON: `{ "total": 150, "pendientes": 45, "en_proceso": 30, "resueltas": 75 }`.
- **Estado:** ⚠️ Parcial | **Implementación:** GET /api/incidents/stats (IncidentStatsController.__invoke(), lines 27-71) returns `{ total, by_status, by_priority, average_resolution_time, ... }`. **Note:** Endpoint is `/incidents/stats` NOT `/metricas/generales` as spec requires. **BLOCKING ISSUE:** No filter parameter support (inicio, fin, tipo_id, ciudad_id).

---

### RF-FUNC-022_CP-08-02-F: Gráfico de barras muestra incidencias por estado

- **Requisito:** RF-FUNC-022 — Visualización de Gráficos
- **Prueba:** CP-08-02-F
- **Capa:** Frontend (F) | **Responsable:** Integrante 1
- **Descripción:** Ver sección de gráficos en dashboard.
- **Criterio:** Gráfico de barras/torta con colores diferenciados por estado, leyenda explicativa.
- **Estado:** ☑ Completado (por estado) | ❌ Incompleto (por tipo/prioridad) | **Implementación:** C3.js donut chart (initDonut(), lines 51-80) displays Pendientes, En proceso, Resueltas with colors #ffaf01, #5f76e8, #22ca80. **Missing:** No bar chart by type, no chart by priority.

---

### RF-FUNC-022_CP-08-02-BD: Query SQL agrupa correctamente por estado

- **Requisito:** RF-FUNC-022 — Visualización de Gráficos
- **Prueba:** CP-08-02-BD
- **Capa:** Base de Datos (BD) | **Responsable:** Integrante 3
- **Descripción:** Ejecutar query de métricas por estado.
- **Criterio:** `SELECT estado_id, COUNT(*) FROM incidencias GROUP BY estado_id` coincide con datos del dashboard.
- **Estado:** ☑ Completado | **Verificado:** IncidentStatsController.groupCounts() (lines 73-94) uses `selectRaw("status as key, COUNT(*) as count")` with `GROUP BY status`, zero-fills enums. Query tested (IncidentStatsControllerTest.php lines 56-139).

---

### RF-FUNC-023_CP-08-03-F: Filtro por rango de fechas funciona

- **Requisito:** RF-FUNC-023 — Filtros de Dashboard
- **Prueba:** CP-08-03-F
- **Capa:** Frontend (F) | **Responsable:** Integrante 1
- **Descripción:** Seleccionar fechas 01/06/2026 → 08/06/2026, click en "Aplicar".
- **Criterio:** Tarjetas y gráficos muestran únicamente datos del rango seleccionado.
- **Estado:** ❌ Pendiente | **Hallazgo:** Filter button UI exists (dashboard.component.html lines 15-23, "Últimos 30 días") pero **NON-FUNCTIONAL**: no click handlers, no date picker component, no "Aplicar" button. **Backend ready:** EloquentIncidentRepository has filtering infrastructure but IncidentStatsController doesn't apply filters.

---

### RF-FUNC-023_CP-08-03-B: Endpoint filtra por rango de fechas correctamente

- **Requisito:** RF-FUNC-023 — Filtros de Dashboard
- **Prueba:** CP-08-03-B
- **Capa:** Backend (B) | **Responsable:** Integrante 2
- **Descripción:** GET /api/metricas/generales?inicio=2026-06-01&fin=2026-06-08.
- **Criterio:** JSON con métricas únicamente del rango especificado.
- **Estado:** ❌ Pendiente | **Issue:** IncidentStatsController.__invoke() accepts no query params. Need to add: inicio, fin params + `WHERE created_at BETWEEN :inicio AND :fin` logic.

---

### RF-FUNC-023_CP-08-04-F: Filtro por tipo muestra datos correctos

- **Requisito:** RF-FUNC-023 — Filtros de Dashboard
- **Prueba:** CP-08-04-F
- **Capa:** Frontend (F) | **Responsable:** Integrante 1
- **Descripción:** Seleccionar filtro "Tipo: Infraestructura", aplicar.
- **Criterio:** Dashboard muestra únicamente incidencias de tipo Infraestructura.
- **Estado:** ❌ Pendiente | **Hallazgo:** Button "Todos los tipos" (dashboard.component.html line 16) is static text, no dropdown component, no type selection logic.

---

### RF-FUNC-023_CP-08-04-B: Query filtra por tipo_id correctamente

- **Requisito:** RF-FUNC-023 — Filtros de Dashboard
- **Prueba:** CP-08-04-B
- **Capa:** Backend (B) | **Responsable:** Integrante 2
- **Descripción:** GET /api/metricas/generales?tipo_id=1.
- **Criterio:** Métricas filtradas por tipo_id = 1.
- **Estado:** ❌ Pendiente | **Issue:** IncidentStatsController needs `tipo_id` param + `WHERE incident_category_id = :tipo_id` filtering.

---

### RF-FUNC-023_CP-08-05-F: Filtro por ubicación muestra datos correctos

- **Requisito:** RF-FUNC-023 — Filtros de Dashboard
- **Prueba:** CP-08-05-F
- **Capa:** Frontend (F) | **Responsable:** Integrante 1
- **Descripción:** Seleccionar país/provincia/ciudad en filtros, aplicar.
- **Criterio:** Dashboard muestra únicamente incidencias de la ubicación seleccionada.
- **Estado:** ❌ Pendiente | **Hallazgo:** No location cascade UI component. Dashboard doesn't fetch location tree or render country/province/city selectors.

---

### RF-FUNC-023_CP-08-05-B: Query filtra por ubicación correctamente

- **Requisito:** RF-FUNC-023 — Filtros de Dashboard
- **Prueba:** CP-08-05-B
- **Capa:** Backend (B) | **Responsable:** Integrante 2
- **Descripción:** GET /api/metricas/generales?ciudad_id=5.
- **Criterio:** Métricas filtradas por ciudad_id = 5.
- **Estado:** ❌ Pendiente | **Issue:** IncidentStatsController needs `ciudad_id`/`provincia_id`/`pais_id` params. Repository has `applyFilters()` logic for location hierarchy (descendantsAndSelf()) but stats queries don't use it.

---

### RF-FUNC-021_CP-08-06-BD: Tiempo promedio de resolución calculado correctamente

- **Requisito:** RF-FUNC-021 — Métricas Generales
- **Prueba:** CP-08-06-BD
- **Capa:** Base de Datos (BD) | **Responsable:** Integrante 3
- **Descripción:** Query tiempo promedio de resolución.
- **Criterio:** `SELECT AVG(DATEDIFF(fecha_resolucion, created_at))` devuelve valor numérico en días.
- **Estado:** ☑ Completado | **Verificado:** IncidentStatsController (lines 29-44) calculates average with PostgreSQL EPOCH and SQLite strftime, tested in IncidentStatsControllerTest.php lines 56-139. Formatted as "2d 5h" in dashboard.component.js (lines 180-183).

---

### RF-UI-002: Dashboard Principal (UI)

- **Requisito:** RF-UI-002 — Dashboard Principal
- **Pruebas cubiertas:** CP-08-01-F a CP-08-05-F
- **Estado:** ⚠️ Parcial | **Implemented:** Stat cards layout (4-grid responsive), donut chart, activity feed. **Missing:** Filter buttons are NON-FUNCTIONAL (no handlers). No date picker, type dropdown, location cascade. No "Aplicar" (Apply) button. Cards don't update after filter change.

---

### RF-SW-009: API REST Métricas

- **Requisito:** RF-SW-009 — API REST Métricas
- **Pruebas cubiertas:** CP-08-01-B, CP-08-03-B, CP-08-04-B, CP-08-05-B
- **Estado:** ⚠️ Parcial | **Implemented:** Endpoint returns basic stats (total, by_status, avg_resolution_time). **Missing:** No filter parameter support (inicio, fin, tipo_id, ciudad_id, provincia_id, pais_id). Endpoint path is `/incidents/stats` not `/metricas/generales`.

---

## 🚨 CRITICAL GAPS (Blocking implementation)

1. **Backend filters not implemented** — IncidentStatsController needs date range, type, location filters
2. **Frontend filter UI non-functional** — No click handlers on filter buttons, no modal/dropdown for date/type/location
3. **No "Aplicar" button logic** — Click should trigger filtered API call and update cards/charts
4. **No chart update on filter** — Cards/charts don't re-render after filter selection
5. **Missing bar chart by type** — Only donut by status; spec implies chart by type too
6. **No second chart** — Spec suggests multiple visualizations but only 1 implemented

---

> **Total tareas:** 12 | **Completadas:** 3/12 (25%) | **Parciales:** 3/12 (25%) | **Pendientes:** 6/12 (50%)
> **ESTADO M08:** ⚠️ PARCIAL (40% implementado) — Core metrics work, filtering layer entirely missing. **Blocking:** Filter params not wired
