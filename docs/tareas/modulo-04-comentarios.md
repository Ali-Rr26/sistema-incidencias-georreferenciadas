# Módulo 04 — Sistema de Comentarios

**Requisitos SRS:** RF-FUNC-012, RF-FUNC-013, RF-FUNC-014, RF-SW-005
**Casos de prueba:** CP-04-01 a CP-04-10 (10 casos)

---

### RF-FUNC-012_CP-04-01-F: Agregar comentario con texto válido

- **Requisito:** RF-FUNC-012 — Agregar Comentario
- **Prueba:** CP-04-01-F
- **Capa:** Frontend (F) | **Responsable:** Integrante 1
- **Descripción:** Ir a "Comentarios", escribir texto, click en "Comentar".
- **Criterio:** Comentario aparece con texto, autor, fecha y hora relativa.
- **Estado:** ☐ Pendiente

---

### RF-FUNC-012_CP-04-01-B: POST crea comentario con usuario y timestamps

- **Requisito:** RF-FUNC-012 — Agregar Comentario
- **Prueba:** CP-04-01-B
- **Capa:** Backend (B) | **Responsable:** Integrante 2
- **Descripción:** POST /api/incidencias/{id}/comentarios.
- **Criterio:** HTTP 201, registro creado en tabla comentarios con todos los campos.
- **Estado:** ☐ Pendiente

---

### RF-FUNC-012_CP-04-02-F: Comentario vacío rechazado en frontend

- **Requisito:** RF-FUNC-012 — Agregar Comentario
- **Prueba:** CP-04-02-F
- **Capa:** Frontend (F) | **Responsable:** Integrante 1
- **Descripción:** Dejar campo de texto vacío, intentar click en "Comentar".
- **Criterio:** Botón "Comentar" deshabilitado o mensaje de error.
- **Estado:** ☐ Pendiente

---

### RF-FUNC-012_CP-04-02-B: Backend rechaza texto vacío con validación

- **Requisito:** RF-FUNC-012 — Agregar Comentario
- **Prueba:** CP-04-02-B
- **Capa:** Backend (B) | **Responsable:** Integrante 2
- **Descripción:** POST con texto vacío `{ "texto": "" }`.
- **Criterio:** HTTP 422, `"errors": {"texto": ["El campo texto es obligatorio"]}`.
- **Estado:** ☐ Pendiente

---

### RF-FUNC-012_CP-04-03-F: Contador de caracteres visible y funcional

- **Requisito:** RF-FUNC-012 — Agregar Comentario
- **Prueba:** CP-04-03-F
- **Capa:** Frontend (F) | **Responsable:** Integrante 1
- **Descripción:** Escribir texto en textarea, observar contador.
- **Criterio:** Contador muestra "X/1000", cambia en tiempo real, se pone rojo al acercarse al límite.
- **Estado:** ☐ Pendiente

---

### RF-FUNC-013_CP-04-04-F: Ver comentarios ordenados por fecha (más reciente primero)

- **Requisito:** RF-FUNC-013 — Listar Comentarios
- **Prueba:** CP-04-04-F
- **Capa:** Frontend (F) | **Responsable:** Integrante 1
- **Descripción:** Agregar comentario A, esperar, agregar B, ver lista.
- **Criterio:** Comentario B aparece primero (más reciente), seguido de A.
- **Estado:** ☐ Pendiente

---

### RF-FUNC-013_CP-04-04-B: GET retorna comentarios ordenados por created_at DESC

- **Requisito:** RF-FUNC-013 — Listar Comentarios
- **Prueba:** CP-04-04-B
- **Capa:** Backend (B) | **Responsable:** Integrante 2
- **Descripción:** GET /api/incidencias/{id}/comentarios.
- **Criterio:** Array JSON ordenado por created_at DESC.
- **Estado:** ☐ Pendiente

---

### RF-FUNC-014_CP-04-05-F: Eliminar propio comentario

- **Requisito:** RF-FUNC-014 — Eliminar Comentario
- **Prueba:** CP-04-05-F
- **Capa:** Frontend (F) | **Responsable:** Integrante 1
- **Descripción:** Ver comentario propio, click en "Eliminar", confirmar.
- **Criterio:** Comentario desaparece de la lista, toast de confirmación.
- **Estado:** ☐ Pendiente

---

### RF-FUNC-014_CP-04-05-B: DELETE soft delete del comentario

- **Requisito:** RF-FUNC-014 — Eliminar Comentario
- **Prueba:** CP-04-05-B
- **Capa:** Backend (B) | **Responsable:** Integrante 2
- **Descripción:** DELETE /api/comentarios/{id}.
- **Criterio:** HTTP 200, campo deleted_at actualizado, comentario no visible en consultas normales.
- **Estado:** ☐ Pendiente

---

### RF-SW-005: Verificación de endpoints de comentarios

- **Requisito:** RF-SW-005 — API REST Comentarios
- **Pruebas cubiertas:** CP-04-01-B, CP-04-02-B, CP-04-04-B, CP-04-05-B
- **Estado:** ☐ Pendiente

---

> **Total tareas:** 10 | **Frontend:** 5 | **Backend:** 5 | **BD:** 0
