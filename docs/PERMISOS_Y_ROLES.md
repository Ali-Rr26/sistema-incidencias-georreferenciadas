# Permisos y Roles — Sistema de Incidencias Georreferenciadas

Documento que describe los permisos asignados a cada rol de usuario en el sistema.

---

## Estructura de Permisos

Los permisos se organizan en **recursos** y **acciones**. Cada permiso es un par `recurso.acción`.

### Acciones Estándar

- **view**: Ver/listar el recurso
- **create**: Crear nuevo recurso
- **update**: Editar recurso existente
- **delete**: Eliminar recurso (soft delete)
- **manage**: Gestionar cambios de estado/flujo
- **detail**: Ver detalle específico (ej. detalle de feed)

---

## Roles del Sistema

### 1. Admin Sistema (`admin_sistema`)

**Descripción**: Administrador con acceso total a todas las funcionalidades. Gestiona usuarios, organizaciones, categorías y toda configuración del sistema.

**Permisos**:

| Recurso | Actions |
|---------|---------|
| dashboard | view |
| incidents | view, create, update, delete, manage |
| comments | view, create, update, delete |
| status-history | view |
| assignments | view, create, update, delete |
| notifications | view, update |
| locations | view, create, update, delete |
| organizations | view, create, update, delete |
| incident-categories | view, create, update, delete |
| roles | view, create, update, delete |
| users | view, create, update, delete |
| profile | view |

**Total**: 37 permisos

---

### 2. Operador Sistema (`operador_sistema`)

**Descripción**: Operador del sistema. Puede gestionar incidencias, comentarios y notificaciones a nivel general, pero sin acceso a configuración de usuarios, roles u organizaciones.

**Permisos**:

| Recurso | Actions |
|---------|---------|
| dashboard | view |
| incidents | view, create, update, manage |
| comments | view, create, update |
| status-history | view |
| assignments | view |
| notifications | view, update |
| locations | view |
| organizations | view |
| incident-categories | view |
| profile | view |

**Total**: 15 permisos

**Diferencias con Admin Sistema**:
- ❌ No puede eliminar incidencias, comentarios, asignaciones
- ❌ No accede a: usuarios, roles, organizaciones (CRUD completo)

---

### 3. Admin Organización (`admin_organizacion`)

**Descripción**: Administrador de una organización específica. Gestiona incidencias, usuarios y miembros de su organización únicamente (isolamiento de datos).

**Permisos**:

| Recurso | Actions |
|---------|---------|
| dashboard | view |
| incidents | view, create, update, delete, manage |
| comments | view, create, update, delete |
| status-history | view |
| assignments | view, create, update, delete |
| notifications | view, update |
| locations | view |
| organizations | view, update |
| roles | view |
| incident-categories | view |
| users | view, create, update, delete |
| feed | view |
| profile | view |

**Total**: 27 permisos

**Notas**:
- Aislado a su organización (`organization_id`)
- Acceso especial: `feed.view` (para verificar experiencia de ciudadano)
- No puede crear/eliminar organizaciones
- Puede gestionar usuarios solo de su organización

---

### 4. Operador Organización (`operador_organizacion`)

**Descripción**: Operador dentro de una organización. Puede ver y actualizar incidencias, gestionar comentarios y notificaciones.

**Permisos**:

| Recurso | Actions |
|---------|---------|
| incidents | view, update |
| notifications | view, update |
| comments | view, create, update |
| assignments | view |
| profile | view |

**Total**: 8 permisos

**Diferencias**:
- ❌ No puede crear incidencias
- ❌ No puede eliminar nada
- ❌ Acceso limitado a: solo view de asignaciones, no puede crear

---

### 5. Usuario (Ciudadano) (`usuario`)

**Descripción**: Usuario regular/ciudadano. Puede reportar incidencias, ver su feed y comentar en incidencias.

**Permisos**:

| Recurso | Actions |
|---------|---------|
| feed | view, detail |
| incidents | create |
| comments | create, view |
| assignments | view |
| profile | view |

**Total**: 7 permisos

**Restricciones**:
- ✅ Puede crear incidencias
- ✅ Puede comentar en incidencias
- ✅ Puede ver feed público
- ❌ No puede editar/eliminar incidencias
- ❌ No puede gestionar usuarios, roles, organizaciones

---

## Matriz de Permisos Global

| Permiso | Admin Sistema | Operador Sistema | Admin Org | Operador Org | Usuario |
|---------|:---:|:---:|:---:|:---:|:---:|
| dashboard.view | ✅ | ✅ | ✅ | ❌ | ❌ |
| incidents.view | ✅ | ✅ | ✅ | ✅ | ❌ |
| incidents.create | ✅ | ✅ | ✅ | ❌ | ✅ |
| incidents.update | ✅ | ✅ | ✅ | ✅ | ❌ |
| incidents.delete | ✅ | ❌ | ✅ | ❌ | ❌ |
| incidents.manage | ✅ | ✅ | ✅ | ❌ | ❌ |
| comments.view | ✅ | ✅ | ✅ | ✅ | ✅ |
| comments.create | ✅ | ✅ | ✅ | ✅ | ✅ |
| comments.update | ✅ | ✅ | ✅ | ✅ | ❌ |
| comments.delete | ✅ | ❌ | ✅ | ❌ | ❌ |
| status-history.view | ✅ | ✅ | ✅ | ❌ | ❌ |
| assignments.view | ✅ | ✅ | ✅ | ✅ | ✅ |
| assignments.create | ✅ | ❌ | ✅ | ❌ | ❌ |
| assignments.update | ✅ | ❌ | ✅ | ❌ | ❌ |
| assignments.delete | ✅ | ❌ | ✅ | ❌ | ❌ |
| notifications.view | ✅ | ✅ | ✅ | ✅ | ❌ |
| notifications.update | ✅ | ✅ | ✅ | ✅ | ❌ |
| locations.view | ✅ | ✅ | ✅ | ❌ | ❌ |
| locations.create | ✅ | ❌ | ❌ | ❌ | ❌ |
| locations.update | ✅ | ❌ | ❌ | ❌ | ❌ |
| locations.delete | ✅ | ❌ | ❌ | ❌ | ❌ |
| organizations.view | ✅ | ✅ | ✅ | ❌ | ❌ |
| organizations.create | ✅ | ❌ | ❌ | ❌ | ❌ |
| organizations.update | ✅ | ❌ | ✅ | ❌ | ❌ |
| organizations.delete | ✅ | ❌ | ❌ | ❌ | ❌ |
| incident-categories.view | ✅ | ✅ | ✅ | ❌ | ❌ |
| incident-categories.create | ✅ | ❌ | ❌ | ❌ | ❌ |
| incident-categories.update | ✅ | ❌ | ❌ | ❌ | ❌ |
| incident-categories.delete | ✅ | ❌ | ❌ | ❌ | ❌ |
| roles.view | ✅ | ❌ | ✅ | ❌ | ❌ |
| roles.create | ✅ | ❌ | ❌ | ❌ | ❌ |
| roles.update | ✅ | ❌ | ❌ | ❌ | ❌ |
| roles.delete | ✅ | ❌ | ❌ | ❌ | ❌ |
| users.view | ✅ | ❌ | ✅ | ❌ | ❌ |
| users.create | ✅ | ❌ | ✅ | ❌ | ❌ |
| users.update | ✅ | ❌ | ✅ | ❌ | ❌ |
| users.delete | ✅ | ❌ | ✅ | ❌ | ❌ |
| feed.view | ❌ | ❌ | ✅ | ❌ | ✅ |
| feed.detail | ❌ | ❌ | ❌ | ❌ | ✅ |
| profile.view | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Decisiones de Diseño

### Feed.view para Admin Organización

El rol `admin_organizacion` recibe permiso `feed.view` (además de los usuarios comunes) para que los administradores puedan verificar la experiencia del ciudadano navegando el feed públicamente, sin necesidad de cambiar de usuario.

**Fuente**: Backend/database/seeders/RolePermissionSeeder.php:100-103

### Notificaciones para Operador Organización

Se agregó explícitamente `notifications.view` y `notifications.update` al operador de organización para evitar que el menú quedara oculto a pesar de que la API permitía actuar sobre notificaciones.

**Fuente**: Backend/database/seeders/RolePermissionSeeder.php:111-114

---

## Implementación Técnica

### Archivos Relevantes

- **Modelos**:
  - `backend/app/Domains/Users/Models/User.php` — Métodos helper: `isSystemAdmin()`, `isOrganizationAdmin()`, `isOperator()`, `isRegularUser()`
  - `backend/app/Domains/Roles/Models/Role.php` — Relación con permisos
  - `backend/app/Domains/Permissions/Models/Permission.php` — Definición de permisos

- **Enums**:
  - `backend/app/Domains/Roles/Enums/UserRole.php` — Definición de roles (enum)

- **Seeders**:
  - `backend/database/seeders/RolePermissionSeeder.php` — Asignación de permisos a roles (CRUD inicial)

- **Policies**:
  - `backend/app/Domains/Shared/Http/Policies/PermissionPolicy.php` — Base para políticas
  - Cada dominio implementa su propia Policy extendiendo PermissionPolicy
  - Ejemplo: `backend/app/Domains/Users/Http/Policies/UserPolicy.php`

### Flujo de Autorización

1. Usuario accede un endpoint protegido
2. Se invoca la Policy correspondiente (ej. `UserPolicy`)
3. Policy verifica el permiso usando `$user->can('resource.action')`
4. Laravel busca el permiso en la tabla `role_permission` via el rol del usuario
5. ✅ Si existe → autorizado | ❌ Si no existe → 403 Forbidden

### Aislamiento de Datos (Multi-Tenancy)

Para roles con límite de organización (`admin_organizacion`, `operador_organizacion`):

```php
// Ejemplo: UserPolicy::view()
if ($user->isOrganizationAdmin() || $user->isOperator()) {
    return $user->can('users.view') && 
           $user->organization_id === $model->organization_id;
}
```

Los datos se filtran **tanto en Policy como en Queries** para evitar filtraciones.

---

## Gestión de Permisos

### Agregar Nuevo Permiso

1. Crear registro en `permissions` table (via migración o seeder)
2. Asignar a roles en `RolePermissionSeeder::run()`
3. Ejecutar: `php artisan db:seed --class=RolePermissionSeeder`

### Cambiar Permisos de un Rol

1. Editar constante en `RolePermissionSeeder` (ej. `ADMIN_SISTEMA_PERMISSIONS`)
2. Re-ejecutar seeder (borra relaciones previas y reinicia)

### Verificar Permisos Asignados

```bash
# Ver todos los permisos del usuario autenticado
GET /api/me

# Verificar un permiso específico
$user->can('incidents.create') # → true/false
```

---

## Resumen de Acceso por Módulo

### 📊 Dashboard

- Admin Sistema: ✅
- Operador Sistema: ✅
- Admin Organización: ✅
- Operador Organización: ❌
- Usuario: ❌

### 📋 Incidencias

- Admin Sistema: CRUD + Manage
- Operador Sistema: Read/Update + Manage
- Admin Organización: CRUD + Manage (solo su org)
- Operador Organización: Read/Update
- Usuario: Create (reportar incidencia)

### 💬 Comentarios

- Admin Sistema: CRUD
- Operador Sistema: Read/Create/Update
- Admin Organización: CRUD (su org)
- Operador Organización: Read/Create/Update
- Usuario: Read/Create

### 👥 Gestión de Usuarios

- Admin Sistema: CRUD
- Operador Sistema: ❌
- Admin Organización: CRUD (su org)
- Operador Organización: ❌
- Usuario: ❌

### ⚙️ Configuración

- Admin Sistema: ✅ (todo)
- Operador Sistema: ❌
- Admin Organización: ✅ (su org)
- Operador Organización: ❌
- Usuario: ❌

---

## Auditoría y Cumplimiento

Todos los cambios de permisos se registran en:
- Tabla `role_permission` con `created_at` / `updated_at`
- Logs de aplicación (Laravel logs)

Para auditar permisos de usuario:
```bash
SELECT rp.* FROM role_permission rp
JOIN roles r ON rp.role_id = r.role_id
WHERE r.name = 'admin_sistema';
```

---

**Fecha de última actualización**: 2026-07-24  
**Versión del documento**: 1.0  
**Responsable**: Backend Team