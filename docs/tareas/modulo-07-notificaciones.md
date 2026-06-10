# Módulo 07 — Sistema de Notificaciones

**Requisitos SRS:** RF-FUNC-019, RF-FUNC-020, RF-SW-008, RF-UI-005
**Casos de prueba:** CP-07-01 a CP-07-10 (10 casos)

---

### RF-FUNC-020_CP-07-01-F: Badge muestra contador de notificaciones no leídas

- **Requisito:** RF-FUNC-020 — Gestión de Notificaciones
- **Prueba:** CP-07-01-F
- **Capa:** Frontend (F) | **Responsable:** Integrante 1
- **Descripción:** Usuario tiene 3 notificaciones sin leer, observar icono de campana.
- **Criterio:** Badge rojo muestra "3" junto al icono.
- **Estado:** ☐ Pendiente

---

### RF-FUNC-020_CP-07-02-F: Click en notificación la marca como leída

- **Requisito:** RF-FUNC-020 — Gestión de Notificaciones
- **Prueba:** CP-07-02-F
- **Capa:** Frontend (F) | **Responsable:** Integrante 1
- **Descripción:** Click en notificación no leída, verificar badge.
- **Criterio:** Badge decrementa (3→2), notificación cambia estilo (fondo gris a blanco).
- **Estado:** ☐ Pendiente

---

### RF-FUNC-020_CP-07-02-B: PATCH actualiza campo leido a true

- **Requisito:** RF-FUNC-020 — Gestión de Notificaciones
- **Prueba:** CP-07-02-B
- **Capa:** Backend (B) | **Responsable:** Integrante 2
- **Descripción:** PATCH /api/notificaciones/{id} con `{ "leido": true }`.
- **Criterio:** HTTP 200, campo leido=true, timestamp leido_en registrado.
- **Estado:** ☐ Pendiente

---

### RF-FUNC-020_CP-07-03-F: Panel desplegable muestra lista de notificaciones

- **Requisito:** RF-FUNC-020 — Gestión de Notificaciones
- **Prueba:** CP-07-03-F
- **Capa:** Frontend (F) | **Responsable:** Integrante 1
- **Descripción:** Click en icono de campana, ver panel.
- **Criterio:** Panel desplegado con lista: icono de tipo, mensaje resumido, tiempo relativo.
- **Estado:** ☐ Pendiente

---

### RF-FUNC-019_CP-07-04-B: Trigger/Evento crea notificación al cambiar estado

- **Requisito:** RF-FUNC-019 — Generación de Notificaciones
- **Prueba:** CP-07-04-B
- **Capa:** Base de Datos (BD) | **Responsable:** Integrante 3
- **Descripción:** Asignar incidencia a usuario, cambiar estado.
- **Criterio:** Tabla notificaciones tiene nuevo registro con todos los campos.
- **Estado:** ☐ Pendiente

---

### RF-FUNC-020_CP-07-05-F: Botón "Marcar todas como leídas" funciona

- **Requisito:** RF-FUNC-020 — Gestión de Notificaciones
- **Prueba:** CP-07-05-F
- **Capa:** Frontend (F) | **Responsable:** Integrante 1
- **Descripción:** Tener múltiples notificaciones sin leer, click en "Marcar todas como leídas".
- **Criterio:** Todas cambian a estado leído, badge desaparece o muestra 0.
- **Estado:** ☐ Pendiente

---

### RF-FUNC-020_CP-07-05-B: PATCH masivo actualiza todas las notificaciones

- **Requisito:** RF-FUNC-020 — Gestión de Notificaciones
- **Prueba:** CP-07-05-B
- **Capa:** Backend (B) | **Responsable:** Integrante 2
- **Descripción:** PATCH /api/notificaciones/marcar-leidas.
- **Criterio:** HTTP 200, todas las notificaciones del usuario actualizan leido=true.
- **Estado:** ☐ Pendiente

---

### RF-UI-005_CP-07-01-F a CP-07-05-F: Panel de Notificaciones (UI)

- **Requisito:** RF-UI-005 — Panel de Notificaciones
- **Pruebas cubiertas:** CP-07-01-F, CP-07-02-F, CP-07-03-F, CP-07-05-F
- **Estado:** ☐ Pendiente

---

### RF-SW-008_CP-07-02-B a CP-07-05-B: API REST Notificaciones

- **Requisito:** RF-SW-008 — API REST Notificaciones
- **Pruebas cubiertas:** CP-07-02-B, CP-07-04-B, CP-07-05-B
- **Estado:** ☐ Pendiente

---

> **Total tareas:** 10 | **Frontend:** 5 | **Backend:** 4 | **BD:** 1
