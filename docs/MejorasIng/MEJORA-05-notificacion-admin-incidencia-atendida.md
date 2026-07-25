# MEJORA-05: Notificación Admin para Corroborar Incidencia Atendida

**Resumen Ejecutivo**
Cuando operador marca incidencia como resuelta, generar notificación para admin_sistema/admin_organizacion pidiendo aprobación. Implementar flujo aprobación/rechazo. Endpoint para marcar notificaciones como leídas. Widget de notificaciones en navbar + página dedicada `/notificaciones/`. Requiere permiso `notifications.update`.

## Objetivos
- Disparar notificación al marcar status → resuelto
- Evento `IncidentMarkedAsResolved` + Listener
- Registrar en tabla `notifications`
- Endpoint `PUT /api/notifications/{id}/mark-as-read`
- Endpoint `POST /api/notifications/{id}/approve` (aprobar resolución)
- Endpoint `POST /api/notifications/{id}/reject` (rechazar)
- Widget navbar + página notificaciones
- Permitir filtrar por tipo: incidencia_atendida_para_aprobacion

## Cambios Requeridos

### Backend

**Archivo**: Crear `backend/app/Domains/Incidents/Events/IncidentMarkedAsResolved.php`

```php
namespace App\Domains\Incidents\Events;

use App\Domains\Incidents\Models\Incident;
use Illuminate\Foundation\Events\Dispatchable;

class IncidentMarkedAsResolved
{
    use Dispatchable;
    
    public function __construct(
        public Incident $incident,
        public int $resolvedById // usuario que marcó como resuelto
    ) {}
}
```

**Archivo**: Crear `backend/app/Domains/Incidents/Listeners/NotifyAdminIncidentResolved.php`

```php
namespace App\Domains\Incidents\Listeners;

use App\Domains\Incidents\Events\IncidentMarkedAsResolved;
use App\Domains\Notifications\Models\Notification;
use App\Domains\Users\Models\User;

class NotifyAdminIncidentResolved
{
    public function handle(IncidentMarkedAsResolved $event): void
    {
        $incident = $event->incident;
        
        // Obtener admins relevantes
        $admins = $this->getAdminsToNotify($incident);
        
        foreach ($admins as $admin) {
            Notification::create([
                'user_id' => $admin->user_id,
                'type' => 'incidencia_atendida_para_aprobacion',
                'title' => 'Incidencia #' . $incident->incident_id . ' marcada como resuelta',
                'message' => 'La incidencia "' . $incident->titulo . '" fue marcada como resuelta por '
                    . User::find($event->resolvedById)->name 
                    . '. ¿Aprobar resolución?',
                'related_type' => 'incident',
                'related_id' => $incident->incident_id,
                'data' => [
                    'incident_id' => $incident->incident_id,
                    'resolved_by' => $event->resolvedById,
                ],
                'is_read' => false,
            ]);
        }
    }
    
    private function getAdminsToNotify(Incident $incident): \Illuminate\Database\Eloquent\Collection
    {
        // Si hay admin_organizacion en esa org, notificar a él
        // + notificar a admin_sistema
        
        $admins = User::query()
            ->whereHas('roles', fn ($q) => 
                $q->whereIn('name', ['admin_sistema', 'admin_organizacion'])
            )
            ->where(function ($q) use ($incident) {
                $q->whereHas('roles', fn ($r) => $r->where('name', 'admin_sistema'))
                  ->orWhere('organization_id', $incident->organization_id);
            })
            ->get();
        
        return $admins;
    }
}
```

**Archivo**: Registrar listener en `backend/app/Providers/EventServiceProvider.php`

```php
protected $listen = [
    \App\Domains\Incidents\Events\IncidentMarkedAsResolved::class => [
        \App\Domains\Incidents\Listeners\NotifyAdminIncidentResolved::class,
    ],
];
```

**Archivo**: Actualizar `backend/app/Domains/Incidents/Models/Incident.php`

En el método booted() o donde cambie status:

```php
protected static function booted(): void
{
    static::updating(function (Incident $incident) {
        if ($incident->isDirty('status') && 
            $incident->status === IncidentStatus::Resolved &&
            $incident->getOriginal('status') !== IncidentStatus::Resolved) {
            
            $incident->resolution_date = now();
            
            // Disparar evento
            IncidentMarkedAsResolved::dispatch($incident, auth()->id());
        }
    });
}
```

**Archivo**: Crear `backend/app/Domains/Notifications/Http/NotificationController.php`

```php
namespace App\Domains\Notifications\Http;

use App\Domains\Notifications\Models\Notification;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Incidents\Enums\IncidentStatus;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth:sanctum');
    }
    
    public function index(Request $request): JsonResponse
    {
        // GET /api/notifications
        // Solo las del usuario autenticado
        
        $notifications = Notification::query()
            ->where('user_id', auth()->id())
            ->orderBy('created_at', 'desc')
            ->paginate(15);
        
        return response()->json($notifications);
    }
    
    public function markAsRead(Notification $notification): JsonResponse
    {
        // PUT /api/notifications/{id}/mark-as-read
        
        $this->authorize('update', $notification);
        
        $notification->update(['is_read' => true]);
        
        return response()->json(['message' => 'Marcada como leída']);
    }
    
    public function approve(Notification $notification): JsonResponse
    {
        // POST /api/notifications/{id}/approve
        
        $this->authorize('update', $notification);
        
        if ($notification->type !== 'incidencia_atendida_para_aprobacion') {
            return response()->json(['message' => 'Tipo inválido'], 400);
        }
        
        $incidentId = $notification->related_id;
        $incident = Incident::find($incidentId);
        
        if (!$incident) {
            return response()->json(['message' => 'Incidencia no encontrada'], 404);
        }
        
        // Marcar como aprovada (actualizar status o flag)
        $incident->update([
            'status' => IncidentStatus::Resolved,
            'approved_by' => auth()->id(),
            'approved_at' => now(),
        ]);
        
        // Marcar notificación como leída
        $notification->update([
            'is_read' => true,
            'action_taken_at' => now(),
            'action' => 'approve',
        ]);
        
        return response()->json([
            'message' => 'Resolución aprobada',
            'incident' => $incident
        ]);
    }
    
    public function reject(Notification $notification, Request $request): JsonResponse
    {
        // POST /api/notifications/{id}/reject
        
        $this->authorize('update', $notification);
        
        if ($notification->type !== 'incidencia_atendida_para_aprobacion') {
            return response()->json(['message' => 'Tipo inválido'], 400);
        }
        
        $incidentId = $notification->related_id;
        $incident = Incident::find($incidentId);
        
        if (!$incident) {
            return response()->json(['message' => 'Incidencia no encontrada'], 404);
        }
        
        // Revertir a en proceso
        $incident->update([
            'status' => IncidentStatus::InProgress,
        ]);
        
        // Marcar notificación
        $notification->update([
            'is_read' => true,
            'action_taken_at' => now(),
            'action' => 'reject',
            'rejection_reason' => $request->input('reason'),
        ]);
        
        return response()->json([
            'message' => 'Resolución rechazada',
            'incident' => $incident
        ]);
    }
}
```

**Archivo**: Actualizar `backend/routes/api.php`

```php
Route::middleware('auth:sanctum')->group(function () {
    Route::apiResource('notifications', NotificationController::class);
    
    Route::prefix('notifications')->group(function () {
        Route::put('/{notification}/mark-as-read', 
            [NotificationController::class, 'markAsRead']);
        Route::post('/{notification}/approve', 
            [NotificationController::class, 'approve']);
        Route::post('/{notification}/reject', 
            [NotificationController::class, 'reject']);
    });
});
```

**Archivo**: Verificar/actualizar `backend/app/Domains/Notifications/Models/Notification.php`

```php
class Notification extends Model
{
    protected $table = 'notifications';
    protected $primaryKey = 'notification_id';
    
    protected $fillable = [
        'user_id',
        'type',
        'title',
        'message',
        'related_type',
        'related_id',
        'data',
        'is_read',
        'action',
        'action_taken_at',
        'rejection_reason',
        'approved_by',
        'approved_at',
    ];
    
    protected $casts = [
        'data' => 'json',
        'is_read' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'action_taken_at' => 'datetime',
        'approved_at' => 'datetime',
    ];
    
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
```

**Archivo**: Crear/actualizar migración de notificaciones (si falta)

```php
// 2026_07_24_000001_update_notifications_table.php
Schema::table('notifications', function (Blueprint $table) {
    $table->enum('type', [
        'incidencia_atendida_para_aprobacion',
        'incidencia_comentario',
        'asignacion_incidencia',
        // ... otros tipos
    ])->default('incidencia_comentario');
    
    $table->string('action')->nullable(); // approve, reject
    $table->timestamp('action_taken_at')->nullable();
    $table->text('rejection_reason')->nullable();
    $table->unsignedBigInteger('approved_by')->nullable();
    $table->timestamp('approved_at')->nullable();
});
```

### Frontend

**Archivo**: Crear `frontend/app/notificaciones/notificaciones.js`

```javascript
import { API_BASE_URL, getToken } from '../core/config.js';

class NotificacionesModule {
    constructor() {
        this.notifications = [];
        this.init();
    }
    
    async init() {
        await this.loadNotifications();
        this.setupEventListeners();
        this.startPolling(); // Polling cada 30s
    }
    
    async loadNotifications() {
        try {
            const response = await fetch(`${API_BASE_URL}/notifications`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            
            const data = await response.json();
            this.notifications = data.data;
            this.renderNotifications();
            this.updateNotificationBadge();
        } catch (error) {
            console.error('Error cargando notificaciones:', error);
        }
    }
    
    renderNotifications() {
        const container = document.querySelector('#notifications-list');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (this.notifications.length === 0) {
            container.innerHTML = `
                <div class="alert alert-info">
                    No hay notificaciones
                </div>
            `;
            return;
        }
        
        this.notifications.forEach(notif => {
            const html = this.getNotificationHtml(notif);
            container.insertAdjacentHTML('beforeend', html);
        });
        
        // Adjuntar listeners a botones
        this.attachNotificationListeners();
    }
    
    getNotificationHtml(notif) {
        const isUnread = !notif.is_read ? 'unread' : '';
        const icon = this.getIconByType(notif.type);
        
        if (notif.type === 'incidencia_atendida_para_aprobacion') {
            return `
                <div class="notification-item ${isUnread}" data-notification-id="${notif.notification_id}">
                    <div class="notif-icon">${icon}</div>
                    <div class="notif-content">
                        <h6>${notif.title}</h6>
                        <p>${notif.message}</p>
                        <small>${new Date(notif.created_at).toLocaleString()}</small>
                        <div class="notif-actions mt-2">
                            <button class="btn btn-sm btn-success approve-btn" 
                                    data-id="${notif.notification_id}">
                                Aprobar
                            </button>
                            <button class="btn btn-sm btn-danger reject-btn"
                                    data-id="${notif.notification_id}">
                                Rechazar
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="notification-item ${isUnread}" data-notification-id="${notif.notification_id}">
                <div class="notif-icon">${icon}</div>
                <div class="notif-content">
                    <h6>${notif.title}</h6>
                    <p>${notif.message}</p>
                    <small>${new Date(notif.created_at).toLocaleString()}</small>
                </div>
            </div>
        `;
    }
    
    getIconByType(type) {
        const icons = {
            'incidencia_atendida_para_aprobacion': '✓',
            'incidencia_comentario': '💬',
            'asignacion_incidencia': '👤',
        };
        return icons[type] || 'ℹ️';
    }
    
    attachNotificationListeners() {
        document.querySelectorAll('.approve-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.approveNotification(e));
        });
        
        document.querySelectorAll('.reject-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.rejectNotification(e));
        });
    }
    
    async approveNotification(e) {
        const btn = e.target;
        const notifId = btn.dataset.id;
        
        try {
            const response = await fetch(`${API_BASE_URL}/notifications/${notifId}/approve`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getToken()}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                showSuccessToast('Incidencia aprobada');
                await this.loadNotifications();
            }
        } catch (error) {
            console.error('Error aprobando:', error);
        }
    }
    
    async rejectNotification(e) {
        const btn = e.target;
        const notifId = btn.dataset.id;
        const reason = prompt('Motivo de rechazo:');
        
        if (!reason) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/notifications/${notifId}/reject`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ reason })
            });
            
            if (response.ok) {
                showSuccessToast('Incidencia rechazada');
                await this.loadNotifications();
            }
        } catch (error) {
            console.error('Error rechazando:', error);
        }
    }
    
    updateNotificationBadge() {
        const unreadCount = this.notifications.filter(n => !n.is_read).length;
        const badge = document.querySelector('#notif-badge');
        
        if (badge) {
            if (unreadCount > 0) {
                badge.textContent = unreadCount;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }
    }
    
    setupEventListeners() {
        const refreshBtn = document.querySelector('#refresh-notifications');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadNotifications());
        }
    }
    
    startPolling() {
        setInterval(() => {
            this.loadNotifications();
        }, 30000); // Cada 30 segundos
    }
}

export default NotificacionesModule;
```

**Archivo**: Crear `frontend/app/notificaciones/notificaciones.html`

```html
<div id="main-wrapper" data-theme="light" data-layout="vertical" 
     data-navbarbg="skin6" data-sidebartype="full" 
     data-sidebar-position="fixed" data-header-position="fixed" 
     data-boxed-layout="full">
    
    <div class="preloader"></div>
    
    <!-- Topbar y Sidebar -->
    
    <div class="page-wrapper">
        <div class="page-breadcrumb">
            <div class="row align-items-center">
                <div class="col-md-8">
                    <h1 class="page-title">Notificaciones</h1>
                </div>
                <div class="col-md-4 text-end">
                    <button id="refresh-notifications" class="btn btn-sm btn-outline-secondary">
                        <i data-feather="refresh-cw"></i> Refrescar
                    </button>
                </div>
            </div>
        </div>
        
        <div class="container-fluid">
            <div class="row">
                <div class="col-md-12">
                    <div class="notifications-container">
                        <div id="notifications-list" class="notifications-list">
                            <!-- Notificaciones renderizadas aquí -->
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<style>
    .notification-item {
        display: flex;
        padding: 15px;
        border-bottom: 1px solid #eee;
        background: #f9f9f9;
        transition: background 0.2s;
    }
    
    .notification-item.unread {
        background: #e3f2fd;
        border-left: 4px solid #2196f3;
    }
    
    .notification-item:hover {
        background: #e8e8e8;
    }
    
    .notif-icon {
        font-size: 1.5rem;
        margin-right: 15px;
    }
    
    .notif-content {
        flex: 1;
    }
    
    .notif-content h6 {
        margin: 0 0 5px 0;
        font-weight: 600;
    }
    
    .notif-content p {
        margin: 0 0 10px 0;
        font-size: 0.9rem;
    }
    
    .notif-actions button {
        margin-right: 5px;
    }
</style>

<script src="../assets/libs/jquery/dist/jquery.min.js"></script>
<script src="../assets/libs/popper.js/dist/umd/popper.min.js"></script>
<script src="../assets/libs/bootstrap/dist/js/bootstrap.min.js"></script>
<script src="https://unpkg.com/feather-icons/dist/feather.min.js"></script>

<script type="module">
    import NotificacionesModule from './notificaciones.js';
    document.addEventListener('DOMContentLoaded', () => {
        new NotificacionesModule();
        feather.replace();
        $('.preloader').fadeOut(500);
    });
</script>
```

**Archivo**: Crear widget navbar `frontend/app-shell/notification-widget.html`

```html
<li class="nav-item dropdown">
    <a class="nav-link dropdown-toggle" href="#" id="notificationDropdown" 
       role="button" data-bs-toggle="dropdown">
        <i data-feather="bell"></i>
        <span id="notif-badge" class="badge badge-danger">0</span>
    </a>
    
    <div class="dropdown-menu dropdown-menu-end notification-dropdown" 
         aria-labelledby="notificationDropdown">
        <div class="dropdown-header">Notificaciones</div>
        <div id="navbar-notif-list" class="notification-dropdown-list" style="max-height: 400px; overflow-y: auto;">
            <!-- Las primeras 5 notificaciones -->
        </div>
        <a href="/#/notificaciones/" class="dropdown-footer">Ver todas</a>
    </div>
</li>

<style>
    .notification-dropdown-list {
        padding: 0;
    }
    
    .notification-dropdown-list .notif-preview {
        padding: 10px;
        border-bottom: 1px solid #eee;
        cursor: pointer;
        font-size: 0.85rem;
    }
    
    .notification-dropdown-list .notif-preview:hover {
        background: #f5f5f5;
    }
    
    .notification-dropdown-list .notif-preview.unread {
        background: #e3f2fd;
        font-weight: 500;
    }
    
    #notif-badge {
        position: absolute;
        top: -5px;
        right: -5px;
        font-size: 0.7rem;
    }
</style>
```

**Archivo**: Actualizar `frontend/app/app.js`

```javascript
{
    path: '/notificaciones',
    component: () => import('./notificaciones/notificaciones.html'),
    requireAuth: true,
    meta: { title: 'Notificaciones' }
}
```

### Base de Datos

Verificar que tabla `notifications` tenga columnas necesarias:

```sql
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action VARCHAR(50) NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_taken_at TIMESTAMP NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS rejection_reason TEXT NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS approved_by BIGINT NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP NULL;
```

## Archivos Afectados

| Ruta | Cambio |
|------|--------|
| `backend/app/Domains/Incidents/Events/IncidentMarkedAsResolved.php` | Crear nuevo |
| `backend/app/Domains/Incidents/Listeners/NotifyAdminIncidentResolved.php` | Crear nuevo |
| `backend/app/Domains/Incidents/Models/Incident.php` | Disparar evento en booted() |
| `backend/app/Providers/EventServiceProvider.php` | Registrar listener |
| `backend/app/Domains/Notifications/Http/NotificationController.php` | Crear/actualizar |
| `backend/app/Domains/Notifications/Models/Notification.php` | Agregar campos |
| `backend/routes/api.php` | Agregar rutas notifications |
| `backend/database/migrations/` | Crear migración de campos |
| `frontend/app/notificaciones/notificaciones.js` | Crear nuevo |
| `frontend/app/notificaciones/notificaciones.html` | Crear nuevo |
| `frontend/app-shell/notification-widget.html` | Crear nuevo |
| `frontend/app/app.js` | Registrar ruta |

## Pasos de Implementación Detallados

### 1. Backend

**Paso 1.1**: Crear event y listener
```bash
cd backend
touch app/Domains/Incidents/Events/IncidentMarkedAsResolved.php
touch app/Domains/Incidents/Listeners/NotifyAdminIncidentResolved.php
```

**Paso 1.2**: Registrar en EventServiceProvider
```php
// app/Providers/EventServiceProvider.php
protected $listen = [
    IncidentMarkedAsResolved::class => [NotifyAdminIncidentResolved::class],
];
```

**Paso 1.3**: Actualizar Incident model
```php
// En booted():
if (status cambió a Resolved) {
    IncidentMarkedAsResolved::dispatch($incident, auth()->id());
}
```

**Paso 1.4**: Crear NotificationController
```bash
touch app/Domains/Notifications/Http/NotificationController.php
```

Métodos: index(), markAsRead(), approve(), reject()

**Paso 1.5**: Registrar rutas
```php
// routes/api.php
Route::apiResource('notifications', NotificationController::class);
Route::post('/notifications/{notification}/approve', ...);
Route::post('/notifications/{notification}/reject', ...);
```

**Paso 1.6**: Crear migración
```bash
php artisan make:migration update_notifications_table --table=notifications
```

Agregar columnas: action, action_taken_at, rejection_reason, approved_by, approved_at

**Paso 1.7**: Test endpoint
```bash
# 1. Cambiar incidencia a resuelto
# 2. Verificar notificación creada en BD
# 3. GET /api/notifications → muestra notificación
```

### 2. Frontend

**Paso 2.1**: Crear módulo notificaciones
```bash
cd frontend
mkdir -p app/notificaciones
touch app/notificaciones/notificaciones.js
touch app/notificaciones/notificaciones.html
```

**Paso 2.2**: Implementar NotificacionesModule
```javascript
// Carga, renderiza, maneja approve/reject
```

**Paso 2.3**: Crear widget navbar
```bash
touch app-shell/notification-widget.html
```

**Paso 2.4**: Registrar ruta
```javascript
// app/app.js
{ path: '/notificaciones', component: ... }
```

**Paso 2.5**: Test en browser
```bash
npm run dev

# 1. Loguear como admin
# 2. Operador marca incidencia como resuelta
# 3. Bell widget muestra badge con 1 notificación
# 4. Clic en notificación → dropdown muestra resumen
# 5. Clic "Ver todas" → página /notificaciones/
# 6. Botones "Aprobar" / "Rechazar" funcionan
```

## Testing

### Caso 1: Crear notificación
```
Acción: Operador cambia status incidencia → Resuelto
Esperado:
- Evento IncidentMarkedAsResolved disparado
- Listener crea 2 registros en notifications:
  - 1 para admin_sistema
  - 1 para admin_organizacion (si existe)
- type: 'incidencia_atendida_para_aprobacion'
- is_read: false
```

### Caso 2: GET notificaciones
```
GET /api/notifications
Usuario: admin_sistema
Esperado: 200 OK
- data[]: array de 5-10 notificaciones recientes
- Incluir notificación incidencia_atendida_para_aprobacion
```

### Caso 3: Aprobar resolución
```
POST /api/notifications/{id}/approve
Usuario: admin_sistema
Esperado: 200 OK
- Notificación.is_read = true
- Notificación.action = 'approve'
- Incident.approved_by = usuario_id
- Incident.approved_at = now
- Toast: "Incidencia aprobada"
```

### Caso 4: Rechazar resolución
```
POST /api/notifications/{id}/reject
Body: { reason: "Falta documentación" }
Usuario: admin_organizacion
Esperado: 200 OK
- Notificación.action = 'reject'
- Notificación.rejection_reason = "Falta documentación"
- Incident.status revertido a 'en_proceso'
```

### Caso 5: Widget navbar
```
Acción: Página carga, hay 3 notificaciones sin leer
Esperado:
- Bell icon visible
- Badge muestra "3"
- Dropdown muestra primeras 3
- "Ver todas" link a /notificaciones/
```

### Caso 6: Permisos
```
Usuario: operador_organizacion
Acción: POST /api/notifications/123/approve
Esperado: 403 Forbidden (no tiene notifications.update)
```

## Impacto

### Performance
- Query: 1 SELECT de notifications, ordenado por created_at
- Polling: 30s (bajo impacto)
- Cache: Datos de notificaciones no necesita cache (bajo volumen)

### Permisos
- Crear: Event/Listener automático
- Leer: `notifications.view` (existe)
- Actualizar: `notifications.update` (verificar si existe)
- Eliminar: No requerid

### UX
- Notificación en tiempo real (polling 30s)
- Flujo: operador → admin → aprobación
- Incidencias rechazadas vuelven a "en proceso"

## Estimación

**Complejidad**: Media  
**Tiempo**: ~3-4 horas  
**Riesgo**: Bajo-Medio (eventos, polling)  
**Esfuerzo**: 6 puntos

## Notas

- Considerar WebSockets en futuro para notificaciones en tiempo real
- Polling 30s es suficiente para MVP
- Implementar soft delete de notificaciones (futuro)
- Agregar email notifications (futuro)
