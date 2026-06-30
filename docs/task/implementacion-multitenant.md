# Plan de Implementación — Lógica Multitenant (Multiempresa)

Este documento detalla las tareas y el alcance técnico requerido para completar la implementación multitenant del sistema, aprovechando las bases de datos y la arquitectura DDD que ya están definidas en el proyecto.

---

## 📋 Estado de la Base de la Aplicación

La base de datos y la estructura del backend ya cuentan con soporte multitenant:
- **Tablas migradas**: `organizations` (con jerarquía `parent_id`), `category_organization` (pivote que asocia organizaciones a categorías de incidentes) y `incident_organization_assignments` (anteriormente `incident_claims` para el historial de reclamos).
- **Modelos Eloquent**: [Incident.php](file:///home/yan2005dris-afk/Documentos/GitHub/sistema-incidencias-georreferenciadas/backend/app/Domains/Incidents/Models/Incident.php), [Organization.php](file:///home/yan2005dris-afk/Documentos/GitHub/sistema-incidencias-georreferenciadas/backend/app/Domains/Organizations/Models/Organization.php) y [IncidentOrganizationAssignment.php](file:///home/yan2005dris-afk/Documentos/GitHub/sistema-incidencias-georreferenciadas/backend/app/Domains/Incidents/Models/IncidentOrganizationAssignment.php) ya están definidos y relacionados.
- **Servicio base testeo**: [ClaimWorkflowTest.php](file:///home/yan2005dris-afk/Documentos/GitHub/sistema-incidencias-georreferenciadas/backend/tests/Feature/Incidents/ClaimWorkflowTest.php) confirma que el guardado de asignaciones y el índice de exclusividad único funcionan correctamente en PostgreSQL.

---

## 🛠️ Tareas Pendientes por Capa

### 1. Backend (Laravel)

#### 📌 Tarea 1.1: Auto-asignación de Incidencias (Auto-claim)
* **Objetivo**: Cuando un usuario crea una incidencia (sin asignar organización), el sistema debe revisar si se puede asignar automáticamente.
* **Lógica a implementar**:
  - Crear un Event Listener u Observer (`IncidentObserver`) para el evento `creating` o `created` del modelo `Incident`.
  - Buscar las organizaciones que tengan asignada la categoría del incidente (`incident_category_id`) en la ubicación geográfica del incidente (`location_id`).
  - **Condición**:
    - Si existe **exactamente una** organización que coincida, llamar a [IncidentOrganizationAssignmentService.php](file:///home/yan2005dris-afk/Documentos/GitHub/sistema-incidencias-georreferenciadas/backend/app/Domains/Incidents/Services/IncidentOrganizationAssignmentService.php) para asignarla automáticamente.
    - Si existen **múltiples** organizaciones (o ninguna), dejar el `organization_id` de la incidencia en `null` (el incidente queda en estado "huérfano/pendiente de reclamo").
* **Ubicación sugerida**: `app/Domains/Incidents/Listeners/AutoAssignIncident.php`.

#### 📌 Tarea 1.2: Endpoints para Reclamo y Liberación Manual (Claim & Release)
* **Objetivo**: Exponer las acciones para que los administradores de organizaciones puedan reclamar o liberar incidencias manualmente.
* **Controladores**:
  - En un nuevo controlador o dentro de [IncidentController.php](file:///home/yan2005dris-afk/Documentos/GitHub/sistema-incidencias-georreferenciadas/backend/app/Domains/Incidents/Http/IncidentController.php), añadir:
    - `POST /api/incidencias/{id}/claim`: Llama al método `claim` de `ClaimService`. Asocia la incidencia a la organización del usuario autenticado.
    - `POST /api/incidencias/{id}/release`: Libera la incidencia, dejando el `organization_id` en `null`.
* **Políticas de Seguridad (`IncidentPolicy`)**:
  - Solo usuarios con rol `admin_organizacion` u `operador_organizacion` que pertenezcan a una organización que cubra esa categoría y zona geográfica pueden reclamar el incidente.

#### 📌 Tarea 1.3: Scoping Global de Incidencias (Aislamiento por Tenant)
* **Objetivo**: Asegurar que cada organización solo pueda ver o modificar sus propios datos.
* **Filtros en el repositorio**:
  - Modificar [EloquentIncidentRepository.php](file:///home/yan2005dris-afk/Documentos/GitHub/sistema-incidencias-georreferenciadas/backend/app/Domains/Incidents/Repositories/EloquentIncidentRepository.php) para aplicar los siguientes alcances según el rol del usuario autenticado:
    - **`admin_sistema` / `operador_sistema`**: Sin restricciones (ven todas las incidencias de todas las organizaciones).
    - **`admin_organizacion` / `operador_organizacion`**:
      - Pueden ver incidencias asignadas a su propia organización (`organization_id = user.organization_id`).
      - Pueden ver incidencias sin asignar (`organization_id IS NULL`) que pertenezcan a la misma categoría y ubicación que su organización pueda cubrir.
    - **`usuario` (Ciudadano)**: Solo tiene acceso a las incidencias públicas a través de la ruta del Feed.

#### 📌 Tarea 1.4: Rate Limiting & Seguridad en el Feed Público
* **Objetivo**: Proteger los endpoints que consumen los ciudadanos sin rol específico para mitigar ataques DDoS o spam.
* **Implementación**:
  - Configurar un middleware de throttling específico en Laravel (ej. `throttle:feed` en `RouteServiceProvider` o directamente en las rutas en `routes/api.php` con límite de 60 peticiones por minuto).

---

### 2. Frontend (Vanilla JS)

#### 📌 Tarea 2.1: Control Dinámico de Rutas y Menú Lateral
* **Objetivo**: Ocultar secciones del panel administrativo para usuarios que no tienen permisos.
* **Implementación**:
  - En [router.js](file:///home/yan2005dris-afk/Documentos/GitHub/sistema-incidencias-georreferenciadas/frontend/app/core/router.js) y el componente de renderizado del sidebar:
    - Si el usuario autenticado tiene el rol `usuario`, redirigirlo siempre al `/feed` y no renderizar el menú lateral (sidebar).
    - Si el usuario tiene rol `operador_organizacion`, ocultar los menús de `/usuarios`, `/organizaciones`, `/localizaciones` y `/categorias` (solo mostrar `/incidencias` asignadas).
    - Solo mostrar todo el menú de administración si el rol es `admin_sistema`.

#### 📌 Tarea 2.2: Panel de Notificaciones y Reclamos (Claim Panel)
* **Objetivo**: Permitir al Admin de Organización visualizar y reclamar incidentes huérfanos.
* **Implementación**:
  - Crear una sección o pestaña en la vista de incidencias llamada "Pendientes de Reclamo".
  - Mostrar la lista de incidencias en su ubicación que no tienen organización asignada pero coinciden con la categoría de su empresa.
  - Añadir el botón "Reclamar Incidencia" que dispare la petición `POST /api/incidencias/{id}/claim`.

#### 📌 Tarea 2.3: Asignación a Operadores
* **Objetivo**: Permitir que el administrador de la organización delegue la resolución a un operador de su misma empresa.
* **Implementación**:
  - En la vista de detalle de la incidencia (cuando ya está reclamada por su organización), mostrar un selector con la lista de usuarios con rol `operador_organizacion` que pertenezcan a la **misma** `organization_id`.
  - Guardar la asignación mediante el endpoint de actualización correspondiente.
