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
- **Estado:** ☐ Pendiente

---

### RF-FUNC-021_CP-08-01-B: Endpoint retorna métricas generales agregadas

- **Requisito:** RF-FUNC-021 — Métricas Generales
- **Prueba:** CP-08-01-B
- **Capa:** Backend (B) | **Responsable:** Integrante 2
- **Descripción:** GET /api/metricas/generales.
- **Criterio:** JSON: `{ "total": 150, "pendientes": 45, "en_proceso": 30, "resueltas": 75 }`.
- **Estado:** ☐ Pendiente

---

### RF-FUNC-022_CP-08-02-F: Gráfico de barras muestra incidencias por estado

- **Requisito:** RF-FUNC-022 — Visualización de Gráficos
- **Prueba:** CP-08-02-F
- **Capa:** Frontend (F) | **Responsable:** Integrante 1
- **Descripción:** Ver sección de gráficos en dashboard.
- **Criterio:** Gráfico de barras/torta con colores diferenciados por estado, leyenda explicativa.
- **Estado:** ☐ Pendiente

---

### RF-FUNC-022_CP-08-02-BD: Query SQL agrupa correctamente por estado

- **Requisito:** RF-FUNC-022 — Visualización de Gráficos
- **Prueba:** CP-08-02-BD
- **Capa:** Base de Datos (BD) | **Responsable:** Integrante 3
- **Descripción:** Ejecutar query de métricas por estado.
- **Criterio:** `SELECT estado_id, COUNT(*) FROM incidencias GROUP BY estado_id` coincide con datos del dashboard.
- **Estado:** ☐ Pendiente

---

### RF-FUNC-023_CP-08-03-F: Filtro por rango de fechas funciona

- **Requisito:** RF-FUNC-023 — Filtros de Dashboard
- **Prueba:** CP-08-03-F
- **Capa:** Frontend (F) | **Responsable:** Integrante 1
- **Descripción:** Seleccionar fechas 01/06/2026 → 08/06/2026, click en "Aplicar".
- **Criterio:** Tarjetas y gráficos muestran únicamente datos del rango seleccionado.
- **Estado:** ☐ Pendiente

---

### RF-FUNC-023_CP-08-03-B: Endpoint filtra por rango de fechas correctamente

- **Requisito:** RF-FUNC-023 — Filtros de Dashboard
- **Prueba:** CP-08-03-B
- **Capa:** Backend (B) | **Responsable:** Integrante 2
- **Descripción:** GET /api/metricas/generales?inicio=2026-06-01&fin=2026-06-08.
- **Criterio:** JSON con métricas únicamente del rango especificado.
- **Estado:** ☐ Pendiente

---

### RF-FUNC-023_CP-08-04-F: Filtro por tipo muestra datos correctos

- **Requisito:** RF-FUNC-023 — Filtros de Dashboard
- **Prueba:** CP-08-04-F
- **Capa:** Frontend (F) | **Responsable:** Integrante 1
- **Descripción:** Seleccionar filtro "Tipo: Infraestructura", aplicar.
- **Criterio:** Dashboard muestra únicamente incidencias de tipo Infraestructura.
- **Estado:** ☐ Pendiente

---

### RF-FUNC-023_CP-08-04-B: Query filtra por tipo_id correctamente

- **Requisito:** RF-FUNC-023 — Filtros de Dashboard
- **Prueba:** CP-08-04-B
- **Capa:** Backend (B) | **Responsable:** Integrante 2
- **Descripción:** GET /api/metricas/generales?tipo_id=1.
- **Criterio:** Métricas filtradas por tipo_id = 1.
- **Estado:** ☐ Pendiente

---

### RF-FUNC-023_CP-08-05-F: Filtro por ubicación muestra datos correctos

- **Requisito:** RF-FUNC-023 — Filtros de Dashboard
- **Prueba:** CP-08-05-F
- **Capa:** Frontend (F) | **Responsable:** Integrante 1
- **Descripción:** Seleccionar país/provincia/ciudad en filtros, aplicar.
- **Criterio:** Dashboard muestra únicamente incidencias de la ubicación seleccionada.
- **Estado:** ☐ Pendiente

---

### RF-FUNC-023_CP-08-05-B: Query filtra por ubicación correctamente

- **Requisito:** RF-FUNC-023 — Filtros de Dashboard
- **Prueba:** CP-08-05-B
- **Capa:** Backend (B) | **Responsable:** Integrante 2
- **Descripción:** GET /api/metricas/generales?ciudad_id=5.
- **Criterio:** Métricas filtradas por ciudad_id = 5.
- **Estado:** ☐ Pendiente

---

### RF-FUNC-021_CP-08-06-BD: Tiempo promedio de resolución calculado correctamente

- **Requisito:** RF-FUNC-021 — Métricas Generales
- **Prueba:** CP-08-06-BD
- **Capa:** Base de Datos (BD) | **Responsable:** Integrante 3
- **Descripción:** Query tiempo promedio de resolución.
- **Criterio:** `SELECT AVG(DATEDIFF(fecha_resolucion, created_at))` devuelve valor numérico en días.
- **Estado:** ☐ Pendiente

---

### RF-UI-002: Dashboard Principal (UI)

- **Requisito:** RF-UI-002 — Dashboard Principal
- **Pruebas cubiertas:** CP-08-01-F a CP-08-05-F
- **Estado:** ☐ Pendiente

---

### RF-SW-009: API REST Métricas

- **Requisito:** RF-SW-009 — API REST Métricas
- **Pruebas cubiertas:** CP-08-01-B, CP-08-03-B, CP-08-04-B, CP-08-05-B
- **Estado:** ☐ Pendiente

---

> **Total tareas:** 12 | **Frontend:** 5 | **Backend:** 5 | **BD:** 2
