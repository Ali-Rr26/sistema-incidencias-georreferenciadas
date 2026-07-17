# Bugs e Inconsistencias

Hallazgos del test E2E con Playwright (`frontend/e2e-flujo-incidencia.js`) ejecutado el 2026-07-17.

## Prioridades

| # | Bug | Impacto | Prioridad | Estado |
|---|-----|---------|-----------|--------|
| 1 | `comments.view` faltante en operador | El operador escribe comentarios que no ve | 🔴 Alta | ✅ Corregido |
| 2 | `organization_id` no se asigna al crear incidencia | Ciudadano crea incidencias que nadie puede gestionar | 🔴 Alta | ✅ Corregido |
| 3 | Admin_sistema no puede asignar operadores | El admin global no puede delegar trabajo | 🟡 Media | ✅ Corregido (por B-02) |
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

## 🔴 B-02: `organization_id` no se asigna automáticamente al crear incidencia ✅ CORREGIDO

### Síntoma
Un ciudadano crea una incidencia con `location_id: 284` (Quito). El backend no asigna `organization_id`, queda `null`. Cuando el admin de GAD Municipal del Cantón Quito (org con `location_id: 284`) intenta ver la incidencia, el backend responde 403.

### Causa
El endpoint `POST /api/incidents` no vinculaba automáticamente la organización basada en la ubicación. Solo asignaba `organization_id` si se enviaba explícitamente. Pero el ciudadano no puede enviar `organization_id` (el frontend no lo manda, y el backend `StoreIncidentRequest::authorize()` lo rechaza para usuarios regulares).

### Evidencia
```
Incidencia #309 creada con location_id=284, organization_id=null
GET /api/incidents/309 con token admin_org_quito → 403
```

### Archivos involucrados
- `backend/app/Domains/Incidents/Http/IncidentController.php`

### Solución aplicada
- Agregada lógica en `IncidentController::store()`: si no se envió `organization_id` pero sí `location_id`, se busca una organización cuyo `location_id` coincida con la ubicación de la incidencia o con alguno de sus ancestros en la jerarquía de ubicaciones.
- Verificado: ciudadano crea incidencia en Quito → `organization_id=1` auto-asignado.
- Verificado con ubicación anidada (Belisario Quevedo → ancestro Quito → GAD Quito).
- Validado con test E2E: flujo ciudadano → admin → operador completo.
- Commit: `<pendiente>`

---

## 🟡 B-03: Admin_sistema no puede asignar operadores ✅ CORREGIDO (por B-02)

### Síntoma
El admin global (`admin@sistema.com`) entra al detalle de una incidencia, ve el formulario de asignación, pero el dropdown de operadores aparece vacío.

### Causa original
El endpoint `available-operators` filtra operadores por `incident->organization_id`. Antes del B-02, las incidencias creadas por ciudadanos tenían `organization_id = null`, por lo que no se encontraban operadores.

### Solución
El B-02 (auto-asignación de organización) resolvió este bug de raíz: ahora toda incidencia tiene `organization_id`, y el endpoint encuentra operadores sin importar quién hace la consulta.
- Verificado: admin_sistema consulta `available-operators` y recibe 2 operadores de GAD Quito.

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
