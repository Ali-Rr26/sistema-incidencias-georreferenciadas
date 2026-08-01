# 📋 Accesos del Rol "Operador" en el Sistema

**Documento:** Detalles de permisos y acciones disponibles  
**Fecha:** 31 de Julio 2026  
**Fuente:** Backend - `RolePermissionSeeder.php`

---

## 👥 Tipos de Operadores en el Sistema

El sistema tiene **2 roles de operador**:

| Rol | ID | Código | Descripción |
|---|---|---|---|
| **Operador de Sistema** | 2 | `operador_sistema` | Operador del sistema general - acceso amplio |
| **Operador de Organización** | 4 | `operador_organizacion` | Operador de una organización específica - acceso limitado a su organización |

---

## 🔐 OPERADOR DE SISTEMA (`operador_sistema`)

### Permisos Disponibles:

| Recurso | Acciones Permitidas | Descripción |
|---|---|---|
| **Dashboard** | `view` | ✅ Ver dashboard del sistema |
| **Incidencias** | `view` | ✅ Ver listado de incidencias |
| | `create` | ✅ Crear nueva incidencia |
| | `update` | ✅ Editar incidencias |
| | `manage` | ✅ Gestionar incidencias (estado, asignaciones) |
| **Comentarios** | `view` | ✅ Ver comentarios en incidencias |
| | `create` | ✅ Agregar comentarios |
| | `update` | ✅ Editar comentarios propios |
| **Status History** | `view` | ✅ Ver historial de cambios de estado |
| **Asignaciones** | `view` | ✅ Ver asignaciones de incidencias |
| **Notificaciones** | `view` | ✅ Ver notificaciones |
| | `update` | ✅ Marcar notificaciones como leídas |
| **Ubicaciones** | `view` | ✅ Ver ubicaciones (ciudades, provincias) |
| **Organizaciones** | `view` | ✅ Ver datos de organizaciones |
| **Categorías** | `view` | ✅ Ver categorías de incidencias |
| **Perfil** | `view` | ✅ Ver y editar perfil personal |

### ❌ Acciones NO Permitidas:

- ❌ Eliminar incidencias
- ❌ Crear o gestionar usuarios
- ❌ Crear o gestionar ubicaciones
- ❌ Crear o gestionar organizaciones
- ❌ Crear o gestionar categorías de incidencias
- ❌ Crear o gestionar roles
- ❌ Acceder a configuración del sistema
- ❌ Eliminar comentarios (solo puede editar los propios)

### Módulos Accesibles:

```
✅ Dashboard
✅ Incidencias (crear, listar, revisar, actualizar estado)
✅ Mapa (ver ubicaciones de incidencias)
✅ Comentarios (agregar, leer, editar propios)
✅ Notificaciones
✅ Perfil
❌ Configuración (Usuarios, Organizaciones, Ubicaciones, Categorías, Roles)
❌ Reportes/Auditoría (si existen)
```

---

## 👥 OPERADOR DE ORGANIZACIÓN (`operador_organizacion`)

### Permisos Disponibles:

| Recurso | Acciones Permitidas | Descripción |
|---|---|---|
| **Dashboard** | `view` | ✅ Ver dashboard |
| **Incidencias** | `view` | ✅ Ver incidencias de su organización |
| | `update` | ✅ Actualizar incidencias |
| **Notificaciones** | `view` | ✅ Ver notificaciones |
| | `update` | ✅ Actualizar notificaciones |
| **Comentarios** | `view` | ✅ Ver comentarios |
| | `create` | ✅ Crear comentarios |
| | `update` | ✅ Editar comentarios propios |
| **Asignaciones** | `view` | ✅ Ver asignaciones |
| **Perfil** | `view` | ✅ Ver perfil personal |

### ❌ Acciones NO Permitidas:

- ❌ Crear incidencias (no es responsabilidad del operador org)
- ❌ Eliminar incidencias
- ❌ Acceder a incidencias de otras organizaciones
- ❌ Crear o editar asignaciones
- ❌ Gestionar usuarios
- ❌ Acceder a configuración
- ❌ Ver datos del sistema general

### Módulos Accesibles:

```
✅ Dashboard
✅ Incidencias (ver y actualizar solo de su organización)
✅ Comentarios (agregar, leer, editar propios)
✅ Notificaciones
✅ Perfil
❌ Mapa
❌ Configuración
❌ Reportes/Auditoría
```

---

## 📊 COMPARATIVA: Operador Sistema vs Operador Organización

| Funcionalidad | Operador Sistema | Operador Organización |
|---|---|---|
| Ver dashboard | ✅ Sí | ✅ Sí |
| Ver incidencias | ✅ Todas | ✅ Solo su organización |
| Crear incidencias | ✅ Sí | ❌ No |
| Editar incidencias | ✅ Sí | ✅ Sí (solo su organización) |
| Gestionar estado/asignación | ✅ Sí | ❌ No |
| Ver comentarios | ✅ Sí | ✅ Sí |
| Crear comentarios | ✅ Sí | ✅ Sí |
| Ver mapa | ✅ Sí | ❌ No |
| Acceder a Configuración | ❌ No | ❌ No |
| Gestionar usuarios | ❌ No | ❌ No |

---

## 🎬 Para tu Video: ¿Cuál Rol Estás Presentando?

### **Si el video es sobre el Operador que revisa y ASIGNA incidencias:**
→ Estás mostrando el rol **`operador_sistema`**

**Acciones clave en el video:**
- ✅ Ver listado de incidencias (todas las del sistema)
- ✅ Revisar detalles de incidencia
- ✅ Agregar comentarios
- ✅ Actualizar estado
- ✅ Gestionar/asignar a técnico ← **`manage` action**

### **Si es sobre un Operador que solo revisa incidencias de su organización:**
→ Estás mostrando el rol **`operador_organizacion`**

**Acciones limitadas:**
- ✅ Ver incidencias de su organización
- ✅ Revisar detalles
- ✅ Agregar comentarios
- ✅ Actualizar estado
- ❌ NO puede crear ni asignar a otros

---

## 🔧 Implementación Técnica

### Rutas Protegidas por Permisos (Backend):

Las rutas están protegidas con middleware que verifica:
```
middleware(['auth:sanctum', 'permission:resource.action'])
```

**Ejemplos:**
```php
// Solo operador_sistema y admin_sistema pueden acceder
Route::get('/incidencias', 'IncidentController@index')
    ->middleware('permission:incidents.view');

// Solo operador_sistema y admin_sistema pueden crear
Route::post('/incidencias', 'IncidentController@store')
    ->middleware('permission:incidents.create');

// Solo operador_sistema puede gestionar (asignar)
Route::put('/incidencias/{id}/assign', 'IncidentController@assign')
    ->middleware('permission:incidents.manage');
```

### Guardias de Permisos (Frontend):

```javascript
// En app-shell.component.js
const navigationItems = [
  {
    label: 'Dashboard',
    route: '#/dashboard',
    requiredPermission: 'dashboard.view'
  },
  {
    label: 'Incidencias',
    route: '#/incidencias',
    requiredPermission: 'incidents.view'
  },
  {
    label: 'Configuración',
    route: '#/configuracion',
    requiredPermission: 'users.view' // Solo admin
  }
];
```

---

## 📝 Resumen: El Operador Puede Hacer

### En el Contexto de tu Video (Operador Sistema):

1. ✅ **Ver** dashboard con métricas del sistema
2. ✅ **Ver** listado de TODAS las incidencias
3. ✅ **Revisar** detalles completos de incidencia (ubicación, categoría, mapa)
4. ✅ **Agregar** comentarios y evidencia (fotos)
5. ✅ **Actualizar** estado de incidencia
6. ✅ **Asignar** incidencia a un técnico específico
7. ✅ **Ver** notificaciones
8. ✅ **Ver** historial de cambios de estado
9. ✅ **Ver** asignaciones

### NO Puede Hacer:

1. ❌ Crear usuarios
2. ❌ Gestionar configuración del sistema
3. ❌ Eliminar incidencias
4. ❌ Ver reportes de auditoría del sistema
5. ❌ Cambiar roles o permisos

---

## 🎯 Para tu Presentación de VENTA

**Énfasis en lo que SÍ puede hacer el Operador:**

> "El operador tiene acceso a TODAS las herramientas necesarias para revisar, validar y asignar incidencias:
> - Información completa de la incidencia (ubicación GPS exacta, descripción, categoría)
> - Capacidad de documentar su revisión con comentarios
> - Poder asignar directamente a un técnico
> - Seguimiento en tiempo real de notificaciones
> - Historial completo de cambios
>
> Lo que NO puede hacer es más importante aún: no puede crear usuarios, no puede cambiar configuración crítica del sistema, y no puede eliminar registros. Esto asegura **seguridad, auditoría y responsabilidad**."

---

**¿Necesitas más detalles sobre algún permiso específico?**