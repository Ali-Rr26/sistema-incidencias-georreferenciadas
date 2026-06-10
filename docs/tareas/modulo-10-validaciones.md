# Módulo 10 — Validaciones de Formato y Seguridad

**Requisitos SRS:** RS-001, RS-002, RS-003, RS-004, RS-005, RR-001, RO-001 (transversales)
**Casos de prueba:** CP-10-01 a CP-10-08 (8 casos)

---

### RS-003_CP-10-01-F: Email con formato inválido muestra error en tiempo real

- **Requisito:** RS-003 — Prevención XSS (validación de entrada)
- **Prueba:** CP-10-01-F
- **Capa:** Frontend (F) | **Responsable:** Integrante 1
- **Descripción:** Escribir "correo@" en campo email, salir del campo (blur).
- **Criterio:** Mensaje "Ingrese un email válido (ejemplo: usuario@dominio.com)".
- **Estado:** ☐ Pendiente

---

### RS-002_CP-10-01-B: Backend valida formato email con regex

- **Requisito:** RS-002 — Prevención Inyección SQL
- **Prueba:** CP-10-01-B
- **Capa:** Backend (B) | **Responsable:** Integrante 2
- **Descripción:** POST /api/login con email sin dominio `"correo@"`.
- **Criterio:** HTTP 422, `"errors": {"email": ["El formato del email es inválido"]}`.
- **Estado:** ☐ Pendiente

---

### RS-001_CP-10-02-F: Campo descripción muestra contador de caracteres

- **Requisito:** RS-001 — Contraseñas (validación de longitud en campos de texto)
- **Prueba:** CP-10-02-F
- **Capa:** Frontend (F) | **Responsable:** Integrante 1
- **Descripción:** Ir a campo descripción, escribir texto, observar contador.
- **Criterio:** Contador "X/500" visible, cambia a rojo al superar 450 caracteres.
- **Estado:** ☐ Pendiente

---

### RS-003_CP-10-03-F: Caracteres especiales HTML/XSS se sanitizan

- **Requisito:** RS-003 — Prevención XSS
- **Prueba:** CP-10-03-F
- **Capa:** Frontend (F) | **Responsable:** Integrante 1
- **Descripción:** Escribir `<script>alert('hack')</script>` en cualquier campo, guardar.
- **Criterio:** Texto se muestra como texto plano, sin HTML interpretado. Verificar DevTools sin código inyectado.
- **Estado:** ☐ Pendiente

---

### RS-002_CP-10-03-B: Sanitización en backend previene XSS

- **Requisito:** RS-002 — Prevención Inyección SQL / RS-003 — XSS
- **Prueba:** CP-10-03-B
- **Capa:** Backend (B) | **Responsable:** Integrante 2
- **Descripción:** Enviar payload con scripts: `"descripcion": "<script>alert('xss')</script>"`.
- **Criterio:** HTTP 422 o texto almacenado sanitizado (HTML entities).
- **Estado:** ☐ Pendiente

---

### RO-001_CP-10-04-F: Campo numérico no acepta letras

- **Requisito:** RO-001 — Responsividad / validación de entrada
- **Prueba:** CP-10-04-F
- **Capa:** Frontend (F) | **Responsable:** Integrante 1
- **Descripción:** Ir a campo prioridad o numérico, intentar escribir letras.
- **Criterio:** Solo valores numéricos o opciones válidas aceptadas.
- **Estado:** ☐ Pendiente

---

### RO-001_CP-10-05-F: Fecha inválida muestra mensaje de error

- **Requisito:** RO-001 — Responsividad / validación de entrada
- **Prueba:** CP-10-05-F
- **Capa:** Frontend (F) | **Responsable:** Integrante 1
- **Descripción:** Ingresar fecha "32/13/2026" o fecha imposible.
- **Criterio:** Mensaje "Fecha inválida".
- **Estado:** ☐ Pendiente

---

### RS-002_CP-10-06-B: Backend valida rango de fechas permitidas

- **Requisito:** RS-002 — Prevención Inyección SQL / validación
- **Prueba:** CP-10-06-B
- **Capa:** Backend (B) | **Responsable:** Integrante 2
- **Descripción:** Enviar fecha fuera de rango válido.
- **Criterio:** HTTP 422 según reglas de negocio.
- **Estado:** ☐ Pendiente

---

> **Total tareas:** 8 | **Frontend:** 5 | **Backend:** 3 | **BD:** 0
