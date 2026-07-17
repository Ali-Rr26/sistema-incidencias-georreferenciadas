# Bugs e Inconsistencias

Hallazgos del test E2E con Playwright (`frontend/e2e-flujo-incidencia.js`) ejecutado el 2026-07-17.

## Prioridades

| # | Bug | Impacto | Prioridad | Estado |
|---|-----|---------|-----------|--------|
| 1 | `comments.view` faltante en operador | El operador escribe comentarios que no ve | 🔴 Alta | ✅ Corregido |
| 2 | `organization_id` no se asigna al crear incidencia | Ciudadano crea incidencias que nadie puede gestionar | 🔴 Alta | ❌ Pendiente |
| 3 | Admin_sistema no puede asignar operadores | El admin global no puede delegar trabajo | 🟡 Media | ❌ Pendiente |
| 4 | Race condition en `setupComments()` | El comentario a veces no se envía | 🟡 Media | ❌ Pendiente |
| 5 | Leaflet en headless frágil | No se puede testear creación de incidencias vía UI | 🔵 Baja (testing) | ❌ Pendiente |

---

## 🔴 B-01: Falta permiso `comments.view` en rol `operador_organizacion` ✅ CORREGIDO

### Síntoma
El operador escribe un comentario, el backend lo crea (HTTP 201), pero la UI nunca lo muestra.

### Causa
El permiso plano `comments.view` no está asignado al rol `operador_organizacion` en el `RolePermissionSeeder`. El operador tiene `comments.create` y `comments.update`, pero no `comments.view`, por lo que `GET /api/incidents/{id}/comments` responde 403.

### Evidencia
```
POST /comments → 201 (creado)
GET  /comments → 403 (no puede listar)
Error al cargar comentarios: No tenés permiso para realizar esta acción.
```

### Archivos involucrados
- `backend/database/seeders/RolePermissionSeeder.php`

### Solución aplicada
- Agregada línea `['resource' => 'comments', 'action' => 'view']` al array `OPERADOR_ORGANIZACION_PERMISSIONS`.
- Re-ejecutado `RolePermissionSeeder` en el contenedor Docker.
- Verificado: el permiso aparece en `GET /api/permissions/my` del operador.
- Validado con test E2E: "✅ Comentario visible en la lista", sin errores 403.
- Commit: `<pendiente>`

---

## 🔴 B-02: `organization_id` no se asigna automáticamente al crear incidencia

### Síntoma
Un ciudadano crea una incidencia con `location_id: 284` (Quito). El backend no asigna `organization_id`, queda `null`. Cuando el admin de GAD Municipal del Cantón Quito (org con `location_id: 284`) intenta ver la incidencia, el backend responde 403.

### Causa
El endpoint `POST /api/incidents` no vincula automáticamente la organización basada en la ubicación. Solo asigna `organization_id` si se envía explícitamente. Pero el ciudadano no puede enviar `organization_id` (el frontend no lo manda, y el backend rechazaría por permisos).

### Evidencia
```
Incidencia #309 creada con location_id=284, organization_id=null
GET /api/incidents/309 con token admin_org_quito → 403
```
El admin_org ve la página pero el contenido muestra "404 — Esta sección aún no está disponible".

### Archivos involucrados
- `backend/app/Http/Controllers/IncidentController.php`
- `backend/app/Services/IncidentService.php` (si existe)
- Flujo de creación desde el frontend ciudadano (`feed/crear`)

### Solución propuesta
En el backend, al crear una incidencia sin `organization_id`, buscar una organización cuyo `location_id` coincida (directa o jerárquicamente) con el `location_id` de la incidencia y asignarla automáticamente.

---

## 🟡 B-03: Admin_sistema no puede asignar operadores

### Síntoma
El admin global (`admin@sistema.com`) entra al detalle de una incidencia, ve el formulario de asignación, pero el dropdown de operadores aparece vacío.

### Causa
El admin_sistema no tiene `organization_id`. El endpoint que lista operadores disponibles filtra por organización. Como admin_sistema no pertenece a ninguna, no encuentra operadores.

### Evidencia
```
Asignaciones form: exists=1, display="block"
Operadores disponibles: 0
```

### Archivos involucrados
- `backend/app/Http/Controllers/AssignmentController.php` (o el que lista usuarios asignables)

### Solución propuesta (a discutir)
¿El admin_sistema debería poder asignar operadores de cualquier organización? ¿O este comportamiento es intencional?

---

## 🟡 B-04: Race condition en `setupComments()`

### Síntoma
Si el comentario se escribe y el botón se clickea antes de que `setupComments()` termine de inicializar, el evento `submit` del form no se dispara y el comentario no se envía.

### Causa
```js
async function setupComments(incidentId) {
  // ...
  const user = await auth.me();  // ⏱️ Async antes de attachar listeners
  // ...
  form.addEventListener('submit', async (e) => { ... });  // 🔗 Listener attachado DESPUÉS
}
```

El `await auth.me()` es asíncrono. Hasta que no resuelve, el `submit` listener no existe. El test de Playwright llena el input y clickea durante esa ventana, el form hace submit nativo sin el handler, y la página se recarga sin enviar el comentario.

### Evidencia
(solo en condiciones de carrera — no siempre reproducible)

### Archivos involucrados
- `frontend/app/incidencias/pages/detail/incidencias.detail.component.js` — función `setupComments`

### Solución propuesta
Mover la inicialización de los listeners de evento ANTES del `await auth.me()`, o marcar el formulario como "no listo" hasta que los listeners estén attachados.

---

## 🔵 B-05: Leaflet no se inicializa en headless Chromium

### Síntoma
El test Playwright no puede probar la creación de incidencias vía UI porque Leaflet no carga en modo headless.

### Causa
Leaflet se carga dinámicamente desde CDN (`https://unpkg.com/leaflet@1.9.4/dist/leaflet.js`). En el entorno headless la inicialización falla intermitentemente sin errores claros. El contenedor del mapa tiene dimensiones, pero Leaflet nunca agrega la clase `.leaflet-container`.

### Impacto
No se puede probar el formulario de creación de incidencias (`/feed/crear` ni `/incidencias/crear`) vía UI.

### Solución propuesta
- Usar `headless: false` en entorno con display
- O mockear Leaflet en el test
- O crear incidencias vía API en el setup del test (como se hizo en el test actual)
