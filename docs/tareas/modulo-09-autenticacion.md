# Módulo 09 — Autenticación y Control de Acceso

**Requisitos SRS:** RF-FUNC-024, RF-FUNC-025, RF-FUNC-026, RF-SW-001, RF-UI-001
**Casos de prueba:** CP-09-01 a CP-09-09 (9 casos)

---

### RF-FUNC-024_CP-09-01-F: Login con credenciales válidas redirige a dashboard

- **Requisito:** RF-FUNC-024 — Login de Usuario
- **Prueba:** CP-09-01-F
- **Capa:** Frontend (F) | **Responsable:** Integrante 1
- **Descripción:** Ingresar admin@ejemplo.com / Admin123, click en "Ingresar".
- **Criterio:** Spinner de carga, redirección a /dashboard, sin errores.
- **Estado:** ☐ Pendiente

---

### RF-FUNC-024_CP-09-01-B: POST /login retorna token JWT o sesión

- **Requisito:** RF-FUNC-024 — Login de Usuario
- **Prueba:** CP-09-01-B
- **Capa:** Backend (B) | **Responsable:** Integrante 2
- **Descripción:** POST /api/login con credenciales válidas.
- **Criterio:** HTTP 200, `{ "token": "...", "user": { "id": 1, "nombre": "...", "rol": "admin" } }`.
- **Estado:** ☐ Pendiente

---

### RF-UI-001_CP-09-02-F: Login con password incorrecto muestra error

- **Requisito:** RF-UI-001 — Pantalla de Login
- **Prueba:** CP-09-02-F
- **Capa:** Frontend (F) | **Responsable:** Integrante 1
- **Descripción:** Email correcto, password equivocado, click "Ingresar".
- **Criterio:** Mensaje "Credenciales incorrectas" en rojo.
- **Estado:** ☐ Pendiente

---

### RF-SW-001_CP-09-02-B: Login falla con credenciales inválidas retorna 401

- **Requisito:** RF-SW-001 — API REST Autenticación
- **Prueba:** CP-09-02-B
- **Capa:** Backend (B) | **Responsable:** Integrante 2
- **Descripción:** POST /api/login con password incorrecto.
- **Criterio:** HTTP 401, `{ "error": "Credenciales inválidas" }`.
- **Estado:** ☐ Pendiente

---

### RF-UI-001_CP-09-03-F: Login con email vacío muestra validación

- **Requisito:** RF-UI-001 — Pantalla de Login
- **Prueba:** CP-09-03-F
- **Capa:** Frontend (F) | **Responsable:** Integrante 1
- **Descripción:** Dejar email vacío, ingresar password, click "Ingresar".
- **Criterio:** Mensaje "El campo email es obligatorio" debajo del campo.
- **Estado:** ☐ Pendiente

---

### RF-FUNC-025_CP-09-04-F: Logout cierra sesión y redirige a login

- **Requisito:** RF-FUNC-025 — Logout de Usuario
- **Prueba:** CP-09-04-F
- **Capa:** Frontend (F) | **Responsable:** Integrante 1
- **Descripción:** Click "Cerrar sesión", intentar acceder a /dashboard.
- **Criterio:** Redirección a /login, token removido de localStorage.
- **Estado:** ☐ Pendiente

---

### RF-FUNC-025_CP-09-04-B: POST /logout invalida token en servidor

- **Requisito:** RF-FUNC-025 — Logout de Usuario
- **Prueba:** CP-09-04-B
- **Capa:** Backend (B) | **Responsable:** Integrante 2
- **Descripción:** POST /api/logout con header Authorization.
- **Criterio:** HTTP 200, token invalidado.
- **Estado:** ☐ Pendiente

---

### RF-FUNC-026_CP-09-05-F: Acceso sin autenticación redirige a login

- **Requisito:** RF-FUNC-026 — Protección de Rutas
- **Prueba:** CP-09-05-F
- **Capa:** Frontend (F) | **Responsable:** Integrante 1
- **Descripción:** Abrir nueva pestaña, ir a /dashboard sin login.
- **Criterio:** Redirección automática a /login.
- **Estado:** ☐ Pendiente

---

### RS-006_CP-09-06-F: Sesión expira y redirige a login

- **Requisito:** RS-006 — Sesiones (expiración)
- **Prueba:** CP-09-06-F
- **Capa:** Frontend (F) | **Responsable:** Integrante 1
- **Descripción:** Esperar expiración del token, intentar request.
- **Criterio:** Mensaje "Sesión expirada", redirección a /login.
- **Estado:** ☐ Pendiente

---

> **Total tareas:** 9 | **Frontend:** 6 | **Backend:** 3 | **BD:** 0
