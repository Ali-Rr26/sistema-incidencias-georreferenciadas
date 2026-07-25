# MEJORA-01: Quitar Permiso Create Incidencias a Admin Sistema

**Resumen Ejecutivo**
El admin_sistema gestiona y aprueba incidencias, no las reporta. Remover permiso `incidents.create` evita ambigüedad de roles y refuerza la separación de responsabilidades. Solo operador_sistema, admin_organizacion y usuarios reportan incidencias.

## Objetivos
- Quitar `incidents.create` de ADMIN_SISTEMA_PERMISSIONS
- Ocultar botón "Nueva Incidencia" en UI si usuario es admin_sistema
- Validar en backend que admin_sistema no pueda crearlas
- Documentar cambio en modelo de permisos

## Cambios Requeridos

### Backend

**Archivo**: `backend/database/seeders/RolePermissionSeeder.php`

```php
// En ADMIN_SISTEMA_PERMISSIONS, REMOVER:
['resource' => 'incidents', 'action' => 'create']

// Quedan permisos: view, update, delete, manage
```

**Archivo**: `backend/app/Domains/Incidents/Http/StoreIncidentRequest.php`

Agregar validación en authorize():
```php
public function authorize(): bool
{
    // Admin sistema NOT permitido
    if (auth()->user()->hasRole('admin_sistema')) {
        return false;
    }
    return auth()->user()->can('incidents.create');
}
```

**Archivo**: `backend/app/Domains/Incidents/Http/IncidentController.php`

En método store(), la validación del FormRequest rechazará automáticamente.

### Frontend

**Archivo**: `frontend/app/incidencias/incidencias.js` (o donde esté module)

Ocultar botón si admin:
```javascript
// En renderIncidenciasUI():
const btnNewIncident = document.querySelector('[data-action="new-incident"]');
if (btnNewIncident) {
    const user = getCurrentUser(); // Obtener del localStorage o sesión
    if (user.role === 'admin_sistema') {
        btnNewIncident.style.display = 'none';
    }
}
```

**Archivo**: `frontend/app/incidencias/` (página principal)

En template HTML, envolver botón con atributo `data-permission="incidents.create"`:
```html
<button id="btn-new-incident" data-action="new-incident" 
        data-permission="incidents.create" class="btn btn-primary">
    Nueva Incidencia
</button>
```

**Archivo**: `frontend/app/shared/utils/permission-utils.js`

Crear utility (si no existe) para verificar permisos:
```javascript
export function hasPermission(user, resource, action) {
    return user?.permissions?.includes(`${resource}.${action}`);
}

export function hideIfNoPermission(selector, permission) {
    const [resource, action] = permission.split('.');
    const user = getCurrentUser();
    const elem = document.querySelector(selector);
    if (elem && !hasPermission(user, resource, action)) {
        elem.style.display = 'none';
    }
}
```

### Base de Datos

No hay cambios a tablas. Solo actualizar datos en `role_permission` vía seeder.

## Archivos Afectados

| Ruta | Cambio |
|------|--------|
| `backend/database/seeders/RolePermissionSeeder.php` | Remover línea `['resource' => 'incidents', 'action' => 'create']` de ADMIN_SISTEMA_PERMISSIONS |
| `backend/app/Domains/Incidents/Http/StoreIncidentRequest.php` | Agregar check en authorize() |
| `frontend/app/incidencias/incidencias.js` | Ocultar botón "Nueva Incidencia" |
| `frontend/app/shared/utils/permission-utils.js` | Crear/actualizar utilities de permisos |

## Pasos de Implementación Detallados

### 1. Backend

**Paso 1.1**: Editar `RolePermissionSeeder.php`
```bash
# Eliminar línea 16 (o equivalente):
# ['resource' => 'incidents', 'action' => 'create'],
```

**Paso 1.2**: Ejecutar seeder:
```bash
cd backend
php artisan db:seed --class=RolePermissionSeeder
```

**Paso 1.3**: Verificar en base de datos:
```bash
# En PostgreSQL:
SELECT rp.*, p.resource, p.action 
FROM role_permission rp
JOIN permissions p ON rp.permission_id = p.permission_id
WHERE rp.role_id = 1 
ORDER BY p.resource;

# No debe aparecer "incidents.create"
```

**Paso 1.4**: Agregar validación en `StoreIncidentRequest.php`:
```php
public function authorize(): bool
{
    $user = $this->user();
    
    // Denegar a admin_sistema
    if ($user->hasRole('admin_sistema')) {
        return false;
    }
    
    return $user->can('incidents.create');
}
```

### 2. Frontend

**Paso 2.1**: Crear/actualizar `permission-utils.js`:
```bash
# Si no existe:
touch frontend/app/shared/utils/permission-utils.js
```

**Paso 2.2**: Implementar logic en módulo incidencias:
```javascript
// En incidencias.js, función init():
document.addEventListener('DOMContentLoaded', () => {
    const user = window.APP_STATE?.currentUser;
    
    if (user?.role === 'admin_sistema') {
        const btnCreate = document.querySelector('[data-action="new-incident"]');
        if (btnCreate) {
            btnCreate.style.display = 'none';
        }
    }
});
```

**Paso 2.3**: Verificar en browser:
- Loguear como admin_sistema
- Ir a módulo Incidencias
- Botón "Nueva Incidencia" debe estar hidden
- Intentar POST /api/incidents directamente → 403 Forbidden

### 3. Testing

**Paso 3.1**: Test backend:
```bash
cd backend

# Crear test:
php artisan make:test Feature/IncidentCreateAdminSistemaTest

# En test:
# - admin_sistema intenta crear incidencia → 403
# - operador_sistema crea incidencia → 201
```

**Paso 3.2**: Test frontend (manual):
```bash
cd frontend
npm run dev

# Loguear como admin_sistema
# Verificar botón escondido
# Abirir DevTools → Network
# Intentar crear incidencia → error 403
```

## Testing

### Caso de Prueba 1: Admin Sistema NO puede crear

```
Rol: admin_sistema
Acción: POST /api/incidents con datos válidos
Esperado: 403 Forbidden
Reasoning: Permiso removido del rol
```

### Caso de Prueba 2: Operador Sistema SÍ puede crear

```
Rol: operador_sistema
Acción: POST /api/incidents con datos válidos
Esperado: 201 Created
Reasoning: Permiso mantiene en rol
```

### Caso de Prueba 3: Botón oculto en UI

```
Rol: admin_sistema
Acción: Navegar a /incidencias
Esperado: Botón "Nueva Incidencia" oculto (display: none)
Reasoning: Lógica de ocultamiento activada
```

### Caso de Prueba 4: Botón visible para otros roles

```
Rol: operador_sistema
Acción: Navegar a /incidencias
Esperado: Botón "Nueva Incidencia" visible
Reasoning: Permiso presente
```

## Impacto

### Performance
- Ninguno. Cambio de datos + validación básica.

### Permisos
- **Antes**: admin_sistema puede crear/ver/editar/eliminar/gestionar incidencias
- **Después**: admin_sistema puede ver/editar/eliminar/gestionar incidencias (NO crear)
- Roles afectados: admin_sistema
- Roles no afectados: operador_sistema, admin_organizacion, operador_organizacion, usuario

### Data Migration
- No required. Seeder actualiza `role_permission` en siguiente ejecución.

### Rollback
- Restaurar línea en `RolePermissionSeeder.php`
- Re-ejecutar seeder
- Restaurar FormRequest.php

## Estimación

**Complejidad**: Simple  
**Tiempo**: ~15 minutos  
**Riesgo**: Bajo (cambio restrictivo, no destructivo)  
**Esfuerzo**: 1 punto

## Notas

- El cambio es **non-breaking** si la funcionalidad no estaba en uso.
- Si hay incidencias creadas por admin_sistema previamente, quedan intactas (ya no pueden crear nuevas).
- La UI sigue mostrando incidencias existentes si admin_sistema tiene `incidents.view`.