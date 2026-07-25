# MEJORA-03: Dashboard Operador por Ubicación

**Resumen Ejecutivo**
Crear dashboard específico para operador_organizacion mostrando incidencias atendidas por ubicación. Filtrable por location_id, rango de fechas (últimos 3 meses). Vista tabla + mapa. Permite analizar cobertura geográfica y performance por zona.

## Objetivos
- Endpoint `GET /api/dashboard/operador-incidencias?location_id=X&months=3`
- Endpoint `GET /api/dashboard/operador-stats` (agregados por ubicación)
- Página frontend `/dashboard-operador/`
- Tabla responsiva con incidencias resueltas
- Mapa Leaflet mostrando pinpoints de incidencias
- Filtros: select ubicación + date range

## Cambios Requeridos

### Backend

**Archivo**: Crear `backend/app/Domains/Incidents/Http/DashboardController.php`

```php
namespace App\Domains\Incidents\Http;

use App\Domains\Incidents\Services\DashboardService;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function __construct(private DashboardService $service)
    {
        $this->middleware('auth:sanctum');
        $this->middleware('can:dashboard.view');
    }
    
    public function operadorIncidencias(Request $request): JsonResponse
    {
        // GET /api/dashboard/operador-incidencias
        // Query params: location_id (int), months (int, default 3)
        
        $locationId = $request->integer('location_id');
        $months = $request->integer('months', 3);
        
        $incidencias = $this->service->getIncidenciasByLocation(
            locationId: $locationId,
            months: $months,
            userId: auth()->id()
        );
        
        return response()->json([
            'data' => $incidencias,
            'count' => count($incidencias),
        ]);
    }
    
    public function operadorStats(Request $request): JsonResponse
    {
        // GET /api/dashboard/operador-stats
        // Estadísticas agregadas por ubicación
        
        $stats = $this->service->getOperadorStats(
            months: $request->integer('months', 3),
            userId: auth()->id()
        );
        
        return response()->json($stats);
    }
}
```

**Archivo**: Crear `backend/app/Domains/Incidents/Services/DashboardService.php`

```php
namespace App\Domains\Incidents\Services;

use App\Domains\Incidents\Models\Incident;
use App\Domains\Incidents\Enums\IncidentStatus;
use App\Domains\Locations\Models\Location;

class DashboardService
{
    public function getIncidenciasByLocation(
        int $locationId,
        int $months = 3,
        int $userId = null
    ): array {
        $query = Incident::query()
            ->with(['location', 'organization', 'category'])
            ->where('status', IncidentStatus::Resolved)
            ->where('location_id', $locationId)
            ->whereBetween('resolution_date', [
                now()->subMonths($months)->startOfDay(),
                now()->endOfDay(),
            ]);
        
        // Si es operador_organizacion, filtrar por su org
        if ($userId) {
            $user = \Auth::user();
            if ($user->hasRole('operador_organizacion')) {
                $query->where('organization_id', $user->organization_id);
            }
        }
        
        return $query->orderBy('resolution_date', 'desc')
            ->get()
            ->map(fn ($incident) => [
                'id' => $incident->incident_id,
                'titulo' => $incident->titulo,
                'status' => $incident->status->value,
                'priority' => $incident->priority->value,
                'resolution_date' => $incident->resolution_date,
                'location' => [
                    'id' => $incident->location->location_id,
                    'nombre' => $incident->location->nombre,
                ],
                'coordinates' => [
                    'lat' => $incident->geom->getLatitude(),
                    'lng' => $incident->geom->getLongitude(),
                ],
            ])
            ->toArray();
    }
    
    public function getOperadorStats(
        int $months = 3,
        int $userId = null
    ): array {
        $baseQuery = Incident::query()
            ->where('status', IncidentStatus::Resolved)
            ->whereBetween('resolution_date', [
                now()->subMonths($months)->startOfDay(),
                now()->endOfDay(),
            ]);
        
        if ($userId) {
            $user = \Auth::user();
            if ($user->hasRole('operador_organizacion')) {
                $baseQuery->where('organization_id', $user->organization_id);
            }
        }
        
        $byLocation = $baseQuery->clone()
            ->selectRaw('location_id, COUNT(*) as total, '
                . "COUNT(CASE WHEN status = ? THEN 1 END) as resueltas")
            ->groupBy('location_id')
            ->with('location')
            ->get()
            ->map(fn ($row) => [
                'location_id' => $row->location_id,
                'location_name' => $row->location->nombre,
                'total' => $row->total,
                'resueltas' => $row->resueltas,
                'porcentaje' => round(($row->resueltas / $row->total) * 100, 2),
            ]);
        
        return [
            'periodo_meses' => $months,
            'fecha_inicio' => now()->subMonths($months)->format('Y-m-d'),
            'fecha_fin' => now()->format('Y-m-d'),
            'por_ubicacion' => $byLocation->toArray(),
        ];
    }
}
```

**Archivo**: Actualizar `backend/routes/api.php`

```php
// Agregar rutas
Route::middleware('auth:sanctum')->group(function () {
    Route::prefix('dashboard')->group(function () {
        Route::get('/operador-incidencias', [DashboardController::class, 'operadorIncidencias']);
        Route::get('/operador-stats', [DashboardController::class, 'operadorStats']);
    });
});
```

**Archivo**: `backend/app/Domains/Incidents/Enums/IncidentStatus.php` (verificar)

Debe tener valor `Resolved`:
```php
case Resolved = 'resuelto';
```

### Frontend

**Archivo**: Crear `frontend/app/dashboard-operador/dashboard-operador.js`

```javascript
import { API_BASE_URL, getToken } from '../core/config.js';
import { initMapWithIncidents } from '../mapa/mapa-utils.js';

class DashboardOperador {
    constructor() {
        this.currentLocation = null;
        this.currentMonths = 3;
        this.incidencias = [];
        this.init();
    }
    
    async init() {
        await this.loadLocations();
        this.setupEventListeners();
        await this.loadIncidencias();
    }
    
    async loadLocations() {
        try {
            const response = await fetch(`${API_BASE_URL}/locations`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            const locations = await response.json();
            this.renderLocationSelect(locations);
        } catch (error) {
            console.error('Error cargando ubicaciones:', error);
        }
    }
    
    renderLocationSelect(locations) {
        const select = document.querySelector('#filter-location');
        select.innerHTML = '<option value="">Seleccionar ubicación...</option>';
        
        locations.forEach(loc => {
            const opt = document.createElement('option');
            opt.value = loc.location_id;
            opt.textContent = loc.nombre;
            select.appendChild(opt);
        });
    }
    
    setupEventListeners() {
        document.querySelector('#filter-location').addEventListener('change', 
            (e) => this.onLocationChange(e));
        document.querySelector('#filter-months').addEventListener('change',
            (e) => this.onMonthsChange(e));
    }
    
    async onLocationChange(e) {
        this.currentLocation = e.target.value;
        if (this.currentLocation) {
            await this.loadIncidencias();
        }
    }
    
    async onMonthsChange(e) {
        this.currentMonths = parseInt(e.target.value);
        if (this.currentLocation) {
            await this.loadIncidencias();
        }
    }
    
    async loadIncidencias() {
        try {
            const url = new URL(`${API_BASE_URL}/dashboard/operador-incidencias`);
            url.searchParams.append('location_id', this.currentLocation);
            url.searchParams.append('months', this.currentMonths);
            
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            
            const data = await response.json();
            this.incidencias = data.data;
            this.renderTable(this.incidencias);
            this.renderMap(this.incidencias);
        } catch (error) {
            console.error('Error cargando incidencias:', error);
        }
    }
    
    renderTable(incidencias) {
        const tbody = document.querySelector('#table-incidencias tbody');
        tbody.innerHTML = '';
        
        if (incidencias.length === 0) {
            tbody.innerHTML = `
                <tr><td colspan="6" class="text-center text-muted">
                    No hay incidencias atendidas en este período
                </td></tr>
            `;
            return;
        }
        
        incidencias.forEach(inc => {
            const row = `
                <tr class="status-${inc.status}">
                    <td>#${inc.id}</td>
                    <td>${escapeHtml(inc.titulo)}</td>
                    <td><span class="badge badge-${inc.priority}">${inc.priority}</span></td>
                    <td>${inc.location.nombre}</td>
                    <td>${new Date(inc.resolution_date).toLocaleDateString()}</td>
                    <td>
                        <a href="/#/incidencias/${inc.id}" class="btn btn-sm btn-outline-primary">
                            Ver
                        </a>
                    </td>
                </tr>
            `;
            tbody.insertAdjacentHTML('beforeend', row);
        });
    }
    
    renderMap(incidencias) {
        const mapContainer = document.querySelector('#map-operador');
        if (!mapContainer) return;
        
        // Usar utilidad de mapa existente
        initMapWithIncidents(mapContainer, incidencias);
    }
}

export default DashboardOperador;
```

**Archivo**: Crear `frontend/app/dashboard-operador/dashboard-operador.html`

```html
<div id="main-wrapper" data-theme="light" data-layout="vertical" 
     data-navbarbg="skin6" data-sidebartype="full" 
     data-sidebar-position="fixed" data-header-position="fixed" 
     data-boxed-layout="full">
    
    <!-- Preloader y componentes de layout estándar -->
    <div class="preloader"></div>
    
    <!-- Topbar (incluir desde template) -->
    <!-- Sidebar (incluir desde template) -->
    
    <div class="page-wrapper">
        <div class="page-breadcrumb">
            <div class="row align-items-center">
                <div class="col-md-8">
                    <h1 class="page-title">Dashboard - Incidencias por Ubicación</h1>
                </div>
            </div>
        </div>
        
        <!-- Controles de filtro -->
        <div class="container-fluid">
            <div class="row mb-4">
                <div class="col-md-6">
                    <label for="filter-location">Ubicación</label>
                    <select id="filter-location" class="form-control">
                        <option value="">Seleccionar ubicación...</option>
                    </select>
                </div>
                <div class="col-md-6">
                    <label for="filter-months">Período</label>
                    <select id="filter-months" class="form-control">
                        <option value="1">Último mes</option>
                        <option value="3" selected>Últimos 3 meses</option>
                        <option value="6">Últimos 6 meses</option>
                        <option value="12">Último año</option>
                    </select>
                </div>
            </div>
        </div>
        
        <!-- Mapa -->
        <div class="container-fluid mb-4">
            <div class="row">
                <div class="col-md-12">
                    <div class="card">
                        <div class="card-header">
                            <h5>Ubicación de Incidencias</h5>
                        </div>
                        <div class="card-body">
                            <div id="map-operador" style="height: 400px;"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Tabla -->
        <div class="container-fluid">
            <div class="row">
                <div class="col-md-12">
                    <div class="card">
                        <div class="card-header">
                            <h5>Incidencias Resueltas</h5>
                        </div>
                        <div class="card-body">
                            <div class="table-responsive">
                                <table id="table-incidencias" class="table table-hover">
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Título</th>
                                            <th>Prioridad</th>
                                            <th>Ubicación</th>
                                            <th>Fecha Resolución</th>
                                            <th>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody></tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="../assets/libs/jquery/dist/jquery.min.js"></script>
<script src="../assets/libs/popper.js/dist/umd/popper.min.js"></script>
<script src="../assets/libs/bootstrap/dist/js/bootstrap.min.js"></script>
<script src="https://unpkg.com/feather-icons/dist/feather.min.js"></script>

<script type="module">
    import DashboardOperador from './dashboard-operador.js';
    document.addEventListener('DOMContentLoaded', () => {
        new DashboardOperador();
        feather.replace();
        $('.preloader').fadeOut(500);
    });
</script>
```

**Archivo**: Actualizar `frontend/app/app.js` (router)

```javascript
// Agregar ruta:
{
    path: '/dashboard-operador',
    component: () => import('./dashboard-operador/dashboard-operador.html'),
    requireAuth: true,
    meta: { title: 'Dashboard Operador' }
}
```

**Archivo**: Actualizar sidebar (ubicarlo en template compartido)

Agregar item:
```html
<li class="sidebar-item">
    <a class="sidebar-link" href="/#/dashboard-operador">
        <i data-feather="pie-chart"></i>
        <span class="hide-menu">Dashboard Operador</span>
    </a>
</li>
```

### Base de Datos

No requiere cambios. Usa tablas existentes:
- `incidents`
- `locations`
- `organizations`

Índices recomendados (ya existen según CLAUDE.md):
```sql
CREATE INDEX idx_incidents_status_location_resolution ON incidents(status, location_id, resolution_date);
```

## Archivos Afectados

| Ruta | Cambio |
|------|--------|
| `backend/app/Domains/Incidents/Http/DashboardController.php` | Crear nuevo |
| `backend/app/Domains/Incidents/Services/DashboardService.php` | Crear nuevo |
| `backend/routes/api.php` | Agregar rutas `/dashboard/*` |
| `frontend/app/dashboard-operador/dashboard-operador.js` | Crear nuevo |
| `frontend/app/dashboard-operador/dashboard-operador.html` | Crear nuevo |
| `frontend/app/app.js` | Registrar ruta |
| `frontend/app-shell/sidebar.html` (o template compartido) | Agregar item menu |

## Pasos de Implementación Detallados

### 1. Backend

**Paso 1.1**: Crear controller
```bash
cd backend
touch app/Domains/Incidents/Http/DashboardController.php
```

Copiar código del pseudocódigo arriba. Reemplazar `Auth::user()` con `auth()->user()`.

**Paso 1.2**: Crear service
```bash
touch app/Domains/Incidents/Services/DashboardService.php
```

Implementar `getIncidenciasByLocation()` y `getOperadorStats()`.

**Paso 1.3**: Agregar rutas
```php
// En routes/api.php:
Route::middleware('auth:sanctum')->group(function () {
    Route::prefix('dashboard')->group(function () {
        Route::get('/operador-incidencias', [DashboardController::class, 'operadorIncidencias']);
        Route::get('/operador-stats', [DashboardController::class, 'operadorStats']);
    });
});
```

**Paso 1.4**: Test endpoint
```bash
# Test local:
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:8000/api/dashboard/operador-incidencias?location_id=1&months=3"

# Debe retornar JSON con array de incidencias + count
```

### 2. Frontend

**Paso 2.1**: Crear archivos
```bash
cd frontend
mkdir -p app/dashboard-operador
touch app/dashboard-operador/dashboard-operador.js
touch app/dashboard-operador/dashboard-operador.html
```

**Paso 2.2**: Implementar clase DashboardOperador
```javascript
// En dashboard-operador.js:
// - Constructor con init()
// - loadLocations()
// - loadIncidencias()
// - renderTable()
// - renderMap()
```

**Paso 2.3**: Crear HTML
```html
<!-- Estructura: container > filters > map > table -->
<!-- Incluir Leaflet CSS/JS -->
```

**Paso 2.4**: Registrar en router
```javascript
// En app.js:
{
    path: '/dashboard-operador',
    component: () => import('./dashboard-operador/dashboard-operador.html'),
    requireAuth: true
}
```

**Paso 2.5**: Agregar a sidebar
```html
<!-- En template compartido -->
<li><a href="/#/dashboard-operador">Dashboard Operador</a></li>
```

**Paso 2.6**: Test en browser
```bash
npm run dev

# 1. Navegar a /#/dashboard-operador
# 2. Select ubicación → carga incidencias
# 3. Tabla y mapa se renderizan
# 4. Cambiar período → actualiza
```

## Testing

### Caso 1: Load operador-incidencias
```
GET /api/dashboard/operador-incidencias?location_id=1&months=3
Usuario: operador_organizacion (org_id=2)
Esperado: 200 OK
- data[]: array con max 10 incidencias resueltas (ejemplo)
- count: 10
- Cada item: id, titulo, status, priority, location, coordinates
- Incidencias filtradas por location_id=1, status=resuelto, fecha ≤ 3 meses
```

### Caso 2: Load operador-stats
```
GET /api/dashboard/operador-stats?months=6
Usuario: operador_organizacion (org_id=2)
Esperado: 200 OK
- periodo_meses: 6
- fecha_inicio: hace 6 meses
- fecha_fin: hoy
- por_ubicacion[]: array con stats por zona
  - location_name, total, resueltas, porcentaje
```

### Caso 3: Filtro por ubicación (UI)
```
Acción: Select ubicación → cambiar período
Esperado:
- Request GET /api/dashboard/operador-incidencias?location_id=2&months=1
- Tabla actualiza mostrando incidencias de esa zona
- Mapa re-centra en esa ubicación
```

### Caso 4: Mapa renderiza pins
```
Acción: Cargar incidencias con coordenadas válidas
Esperado:
- Leaflet muestra pins en mapa
- Click en pin → tooltip con título incidencia
- Zoom automático a bounding box
```

### Caso 5: Permisos
```
Usuario: usuario (rol, no operador)
Acción: Navegar a /#/dashboard-operador
Esperado: Redirect a /login o error 403
Reasoning: Middleware auth:sanctum + can:dashboard.view
```

## Impacto

### Performance
- Query: 1 SELECT desde Incidents (con índices)
- N+1: Usar .with(['location', 'organization']) para eager-load
- Cache: Considerar Redis cache si >1000 incidencias/mes

### Permisos
- Requiere: `dashboard.view`
- Roles: operador_sistema, operador_organizacion, admin_*
- Filtrado automático por org para operador_organizacion

### UX
- Nueva sección en sidebar
- Responsivo en mobile (1 col) → tabla scrollable
- Zoom mapa automático al cambiar ubicación

## Estimación

**Complejidad**: Media  
**Tiempo**: ~4-5 horas  
**Riesgo**: Bajo-Medio (queries complejas, mapa)  
**Esfuerzo**: 8 puntos

## Notas

- Usar eager-load `.with()` para evitar N+1
- Leaflet ya usado en proyecto (verificar mapa-utils.js)
- Cache de ubicaciones en localStorage (cargas futuras)
- Considerar paginación si >500 registros