# MEJORA-04: Dashboard KPI con Tarjetas de Estadísticas

**Resumen Ejecutivo**
Dashboard ejecutivo con tarjetas (stat-cards) mostrando KPIs globales: total incidencias, resueltas, pendientes, tiempo promedio resolución. Gráficos de tendencia (barras/líneas) con libería C3.js. Responsivo: 1 col mobile, 2 tablet, 4 desktop. Acceso para admin_sistema, admin_organizacion, operador_sistema.

## Objetivos
- Endpoint `GET /api/dashboard/kpis` (stats globales)
- Endpoint `GET /api/dashboard/kpis/trends` (tendencia mensual)
- Endpoint `GET /api/dashboard/kpis/by-organization` (stats por org)
- Página frontend `/dashboard-kpi/`
- Tarjetas con grandes números + colores por estado
- Gráficos C3.js (barras: incidencias/mes, línea: tiempo resolución)
- Responsivo con Bootstrap grid

## Cambios Requeridos

### Backend

**Archivo**: Actualizar `backend/app/Domains/Incidents/Http/DashboardController.php`

```php
namespace App\Domains\Incidents\Http;

use App\Domains\Incidents\Services\DashboardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __construct(private DashboardService $service)
    {
        $this->middleware('auth:sanctum');
        $this->middleware('can:dashboard.view');
    }
    
    public function kpis(Request $request): JsonResponse
    {
        // GET /api/dashboard/kpis
        // Stats globales o por organization (si admin_organizacion)
        
        $kpis = $this->service->getGlobalKpis(
            months: $request->integer('months', 12),
            userId: auth()->id()
        );
        
        return response()->json($kpis);
    }
    
    public function kpisTrends(Request $request): JsonResponse
    {
        // GET /api/dashboard/kpis/trends
        // Tendencia mensual últimos N meses
        
        $trends = $this->service->getTrendsByMonth(
            months: $request->integer('months', 12),
            userId: auth()->id()
        );
        
        return response()->json($trends);
    }
    
    public function kpisByOrganization(Request $request): JsonResponse
    {
        // GET /api/dashboard/kpis/by-organization
        // Solo para admin_sistema
        
        if (!auth()->user()->hasRole('admin_sistema')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        
        $stats = $this->service->getKpisByOrganization(
            months: $request->integer('months', 12)
        );
        
        return response()->json($stats);
    }
}
```

**Archivo**: Actualizar `backend/app/Domains/Incidents/Services/DashboardService.php`

```php
namespace App\Domains\Incidents\Services;

use App\Domains\Incidents\Models\Incident;
use App\Domains\Incidents\Enums\IncidentStatus;
use Illuminate\Support\Facades\DB;

class DashboardService
{
    public function getGlobalKpis(int $months = 12, int $userId = null): array
    {
        $startDate = now()->subMonths($months)->startOfDay();
        $endDate = now()->endOfDay();
        
        $baseQuery = Incident::query()
            ->whereBetween('created_at', [$startDate, $endDate]);
        
        // Filtrar por org si operador_organizacion
        if ($userId) {
            $user = \Auth::user();
            if ($user->hasRole('operador_organizacion')) {
                $baseQuery->where('organization_id', $user->organization_id);
            }
        }
        
        $total = $baseQuery->count();
        $resueltas = $baseQuery->where('status', IncidentStatus::Resolved)->count();
        $pendientes = $baseQuery->where('status', IncidentStatus::Pending)->count();
        $enProceso = $baseQuery->where('status', IncidentStatus::InProgress)->count();
        
        // Tiempo promedio de resolución (días)
        $avgResolutionTime = $baseQuery
            ->whereNotNull('resolution_date')
            ->selectRaw('AVG(EXTRACT(DAY FROM (resolution_date - created_at))) as promedio')
            ->first()
            ?->promedio ?? 0;
        
        return [
            'periodo' => [
                'inicio' => $startDate->format('Y-m-d'),
                'fin' => $endDate->format('Y-m-d'),
                'meses' => $months,
            ],
            'total' => $total,
            'resueltas' => $resueltas,
            'pendientes' => $pendientes,
            'en_proceso' => $enProceso,
            'porcentaje_resolucion' => $total > 0 ? round(($resueltas / $total) * 100, 2) : 0,
            'tiempo_promedio_resolucion_dias' => round($avgResolutionTime, 1),
        ];
    }
    
    public function getTrendsByMonth(int $months = 12, int $userId = null): array
    {
        $startDate = now()->subMonths($months)->startOfMonth();
        $endDate = now()->endOfMonth();
        
        $baseQuery = Incident::query()
            ->whereBetween('created_at', [$startDate, $endDate]);
        
        if ($userId) {
            $user = \Auth::user();
            if ($user->hasRole('operador_organizacion')) {
                $baseQuery->where('organization_id', $user->organization_id);
            }
        }
        
        // Agrupar por mes
        $trends = $baseQuery
            ->selectRaw("DATE_TRUNC('month', created_at) as mes, 
                         COUNT(*) as total,
                         COUNT(CASE WHEN status = ? THEN 1 END) as resueltas")
            ->groupBy(DB::raw("DATE_TRUNC('month', created_at)"))
            ->orderBy(DB::raw("DATE_TRUNC('month', created_at)"), 'asc')
            ->get();
        
        // Formatear para C3.js
        $months_array = [];
        $total_array = ['Incidencias'];
        $resueltas_array = ['Resueltas'];
        
        foreach ($trends as $row) {
            $monthStr = $row->mes->format('Y-m');
            $months_array[] = $monthStr;
            $total_array[] = $row->total;
            $resueltas_array[] = $row->resueltas;
        }
        
        return [
            'meses' => $months_array,
            'incidencias' => $total_array,
            'resueltas' => $resueltas_array,
        ];
    }
    
    public function getKpisByOrganization(int $months = 12): array
    {
        $startDate = now()->subMonths($months)->startOfDay();
        $endDate = now()->endOfDay();
        
        $stats = Incident::query()
            ->with('organization')
            ->whereBetween('created_at', [$startDate, $endDate])
            ->selectRaw("
                organization_id,
                COUNT(*) as total,
                COUNT(CASE WHEN status = ? THEN 1 END) as resueltas,
                COUNT(CASE WHEN status = ? THEN 1 END) as pendientes,
                AVG(EXTRACT(DAY FROM (resolution_date - created_at))) as promedio_dias
            ")
            ->groupBy('organization_id')
            ->get()
            ->map(fn ($row) => [
                'organization_id' => $row->organization_id,
                'organization_name' => $row->organization->nombre,
                'total' => $row->total,
                'resueltas' => $row->resueltas,
                'pendientes' => $row->pendientes,
                'porcentaje' => round(($row->resueltas / $row->total) * 100, 2),
                'tiempo_promedio_dias' => round($row->promedio_dias ?? 0, 1),
            ]);
        
        return [
            'periodo_meses' => $months,
            'por_organizacion' => $stats->toArray(),
        ];
    }
}
```

**Archivo**: Actualizar `backend/routes/api.php`

```php
Route::middleware('auth:sanctum')->group(function () {
    Route::prefix('dashboard')->group(function () {
        Route::get('/kpis', [DashboardController::class, 'kpis']);
        Route::get('/kpis/trends', [DashboardController::class, 'kpisTrends']);
        Route::get('/kpis/by-organization', [DashboardController::class, 'kpisByOrganization']);
    });
});
```

### Frontend

**Archivo**: Crear `frontend/app/dashboard-kpi/dashboard-kpi.js`

```javascript
import { API_BASE_URL, getToken } from '../core/config.js';
import * as c3 from 'https://cdn.jsdelivr.net/npm/c3@0.7.20/+esm';

class DashboardKpi {
    constructor() {
        this.currentMonths = 12;
        this.init();
    }
    
    async init() {
        await this.loadKpis();
        await this.loadTrends();
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        document.querySelector('#filter-months-kpi')?.addEventListener('change',
            (e) => this.onMonthsChange(e));
    }
    
    async onMonthsChange(e) {
        this.currentMonths = parseInt(e.target.value);
        await this.loadKpis();
        await this.loadTrends();
    }
    
    async loadKpis() {
        try {
            const url = new URL(`${API_BASE_URL}/dashboard/kpis`);
            url.searchParams.append('months', this.currentMonths);
            
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            
            const kpis = await response.json();
            this.renderKpiCards(kpis);
        } catch (error) {
            console.error('Error cargando KPIs:', error);
        }
    }
    
    renderKpiCards(kpis) {
        const container = document.querySelector('#kpi-cards');
        container.innerHTML = `
            <div class="col-md-6 col-lg-3">
                <div class="kpi-card card border-left-primary">
                    <div class="card-body">
                        <div class="kpi-value text-primary">${kpis.total}</div>
                        <div class="kpi-label">Total Incidencias</div>
                        <small class="text-muted">${kpis.periodo.inicio} a ${kpis.periodo.fin}</small>
                    </div>
                </div>
            </div>
            
            <div class="col-md-6 col-lg-3">
                <div class="kpi-card card border-left-success">
                    <div class="card-body">
                        <div class="kpi-value text-success">${kpis.resueltas}</div>
                        <div class="kpi-label">Resueltas</div>
                        <div class="kpi-percentage">${kpis.porcentaje_resolucion}%</div>
                    </div>
                </div>
            </div>
            
            <div class="col-md-6 col-lg-3">
                <div class="kpi-card card border-left-warning">
                    <div class="card-body">
                        <div class="kpi-value text-warning">${kpis.pendientes}</div>
                        <div class="kpi-label">Pendientes</div>
                        <small class="text-muted">En espera</small>
                    </div>
                </div>
            </div>
            
            <div class="col-md-6 col-lg-3">
                <div class="kpi-card card border-left-info">
                    <div class="card-body">
                        <div class="kpi-value text-info">${kpis.tiempo_promedio_resolucion_dias}</div>
                        <div class="kpi-label">Días Promedio</div>
                        <small class="text-muted">Tiempo de resolución</small>
                    </div>
                </div>
            </div>
        `;
    }
    
    async loadTrends() {
        try {
            const url = new URL(`${API_BASE_URL}/dashboard/kpis/trends`);
            url.searchParams.append('months', this.currentMonths);
            
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            
            const trends = await response.json();
            this.renderCharts(trends);
        } catch (error) {
            console.error('Error cargando trends:', error);
        }
    }
    
    renderCharts(trends) {
        // Gráfico de barras: Incidencias por mes
        c3.generate({
            bindto: '#chart-incidencias-mes',
            data: {
                columns: [trends.incidencias, trends.resueltas],
                type: 'bar',
            },
            axis: {
                x: { label: 'Mes', values: trends.meses },
                y: { label: 'Cantidad' },
            },
            color: {
                pattern: ['#007bff', '#28a745']
            }
        });
        
        // Gráfico de línea: Tendencia de resolución
        c3.generate({
            bindto: '#chart-tendencia',
            data: {
                columns: [trends.incidencias, trends.resueltas],
                type: 'line',
            },
            axis: {
                x: { label: 'Mes', values: trends.meses },
                y: { label: 'Cantidad' },
            },
            color: {
                pattern: ['#ffc107', '#28a745']
            }
        });
    }
}

export default DashboardKpi;
```

**Archivo**: Crear `frontend/app/dashboard-kpi/dashboard-kpi.html`

```html
<div id="main-wrapper" data-theme="light" data-layout="vertical" 
     data-navbarbg="skin6" data-sidebartype="full" 
     data-sidebar-position="fixed" data-header-position="fixed" 
     data-boxed-layout="full">
    
    <div class="preloader"></div>
    
    <!-- Topbar y Sidebar (incluir desde template) -->
    
    <div class="page-wrapper">
        <div class="page-breadcrumb">
            <div class="row align-items-center">
                <div class="col-md-8">
                    <h1 class="page-title">Dashboard - KPIs de Incidencias</h1>
                </div>
                <div class="col-md-4 text-end">
                    <select id="filter-months-kpi" class="form-control d-inline-block w-auto">
                        <option value="1">Último mes</option>
                        <option value="3">Últimos 3 meses</option>
                        <option value="6">Últimos 6 meses</option>
                        <option value="12" selected>Último año</option>
                    </select>
                </div>
            </div>
        </div>
        
        <div class="container-fluid">
            <!-- KPI Cards -->
            <div class="row mb-4" id="kpi-cards">
                <!-- Tarjetas renderizadas aquí -->
            </div>
            
            <!-- Charts -->
            <div class="row">
                <div class="col-lg-6">
                    <div class="card">
                        <div class="card-header">
                            <h5>Incidencias por Mes</h5>
                        </div>
                        <div class="card-body">
                            <div id="chart-incidencias-mes" style="height: 300px;"></div>
                        </div>
                    </div>
                </div>
                
                <div class="col-lg-6">
                    <div class="card">
                        <div class="card-header">
                            <h5>Tendencia de Resolución</h5>
                        </div>
                        <div class="card-body">
                            <div id="chart-tendencia" style="height: 300px;"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<script src="../assets/libs/jquery/dist/jquery.min.js"></script>
<script src="../assets/libs/popper.js/dist/umd/popper.min.js"></script>
<script src="../assets/libs/bootstrap/dist/js/bootstrap.min.js"></script>
<script src="https://unpkg.com/feather-icons/dist/feather.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/c3@0.7.20/+esm"></script>

<script type="module">
    import DashboardKpi from './dashboard-kpi.js';
    document.addEventListener('DOMContentLoaded', () => {
        new DashboardKpi();
        feather.replace();
        $('.preloader').fadeOut(500);
    });
</script>

<style>
    .kpi-card {
        border-radius: 8px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        transition: transform 0.2s;
    }
    
    .kpi-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.15);
    }
    
    .kpi-value {
        font-size: 2.5rem;
        font-weight: bold;
        margin: 10px 0;
    }
    
    .kpi-label {
        font-size: 0.95rem;
        color: #666;
        font-weight: 500;
    }
    
    .kpi-percentage {
        font-size: 1.2rem;
        color: #28a745;
        font-weight: bold;
        margin-top: 5px;
    }
    
    .border-left-primary {
        border-left: 4px solid #007bff;
    }
    
    .border-left-success {
        border-left: 4px solid #28a745;
    }
    
    .border-left-warning {
        border-left: 4px solid #ffc107;
    }
    
    .border-left-info {
        border-left: 4px solid #17a2b8;
    }
    
    @media (max-width: 768px) {
        .kpi-value {
            font-size: 1.8rem;
        }
        
        .kpi-label {
            font-size: 0.85rem;
        }
    }
</style>
```

**Archivo**: Actualizar `frontend/app/app.js`

```javascript
// Agregar ruta:
{
    path: '/dashboard-kpi',
    component: () => import('./dashboard-kpi/dashboard-kpi.html'),
    requireAuth: true,
    meta: { title: 'Dashboard KPI' }
}
```

### Base de Datos

No requiere cambios. Usa tablas existentes con índices de performance.

Verificar índices:
```sql
-- Debe existir:
CREATE INDEX idx_incidents_created_at ON incidents(created_at);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_organization_id ON incidents(organization_id);
CREATE INDEX idx_incidents_resolution_date ON incidents(resolution_date);
```

## Archivos Afectados

| Ruta | Cambio |
|------|--------|
| `backend/app/Domains/Incidents/Http/DashboardController.php` | Agregar métodos kpis(), kpisTrends(), kpisByOrganization() |
| `backend/app/Domains/Incidents/Services/DashboardService.php` | Agregar getGlobalKpis(), getTrendsByMonth(), getKpisByOrganization() |
| `backend/routes/api.php` | Agregar rutas kpis/* |
| `frontend/app/dashboard-kpi/dashboard-kpi.js` | Crear nuevo |
| `frontend/app/dashboard-kpi/dashboard-kpi.html` | Crear nuevo |
| `frontend/app/app.js` | Registrar ruta |
| `frontend/app-shell/sidebar.html` (template compartido) | Agregar item menu |

## Pasos de Implementación Detallados

### 1. Backend

**Paso 1.1**: Actualizar DashboardController
```bash
cd backend
# Actualizar métodos existentes:
# - kpis()
# - kpisTrends()
# - kpisByOrganization()
```

**Paso 1.2**: Actualizar DashboardService
```bash
# Agregar funciones:
# - getGlobalKpis()
# - getTrendsByMonth()
# - getKpisByOrganization()
```

Usar `DATE_TRUNC('month', ...)` para PostgreSQL (ya soportado).

**Paso 1.3**: Registrar rutas
```php
// routes/api.php:
Route::get('/dashboard/kpis', ...)
Route::get('/dashboard/kpis/trends', ...)
Route::get('/dashboard/kpis/by-organization', ...)
```

**Paso 1.4**: Test endpoints
```bash
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:8000/api/dashboard/kpis?months=12"

# Debe retornar JSON con kpis globales
```

### 2. Frontend

**Paso 2.1**: Crear archivos
```bash
cd frontend
mkdir -p app/dashboard-kpi
touch app/dashboard-kpi/dashboard-kpi.js
touch app/dashboard-kpi/dashboard-kpi.html
```

**Paso 2.2**: Implementar DashboardKpi
```javascript
// dashboard-kpi.js:
// - Cargar KPIs
// - Cargar trends
// - Renderizar tarjetas
// - Renderizar gráficos C3.js
```

**Paso 2.3**: Crear HTML
```html
<!-- Estructura: cards row + charts row -->
<!-- Filter select -->
<!-- Gráficos: #chart-incidencias-mes, #chart-tendencia -->
```

**Paso 2.4**: Registrar ruta
```javascript
// app.js:
{
    path: '/dashboard-kpi',
    component: () => import('./dashboard-kpi/dashboard-kpi.html'),
    requireAuth: true
}
```

**Paso 2.5**: Agregar a sidebar
```html
<li><a href="/#/dashboard-kpi">Dashboard KPI</a></li>
```

**Paso 2.6**: Test en browser
```bash
npm run dev

# 1. Navegar a /#/dashboard-kpi
# 2. Tarjetas cargan con números
# 3. Cambiar período → actualiza
# 4. Gráficos renderizan correctamente
# 5. Responsivo en mobile
```

## Testing

### Caso 1: Load KPIs
```
GET /api/dashboard/kpis?months=12
Usuario: admin_sistema
Esperado: 200 OK
- total: 45
- resueltas: 30
- pendientes: 10
- en_proceso: 5
- porcentaje_resolucion: 66.67
- tiempo_promedio_resolucion_dias: 5.2
```

### Caso 2: Load Trends
```
GET /api/dashboard/kpis/trends?months=3
Usuario: operador_sistema
Esperado: 200 OK
- meses: ["2026-05", "2026-06", "2026-07"]
- incidencias: ["Incidencias", 10, 15, 12]
- resueltas: ["Resueltas", 8, 12, 11]
```

### Caso 3: Tarjetas HTML
```
Acción: Cargar /#/dashboard-kpi
Esperado: 4 tarjetas visibles
- Total: número grande
- Resueltas: número + porcentaje (verde)
- Pendientes: número (amarillo)
- Promedio días: número (azul)
```

### Caso 4: Gráficos
```
Acción: Datos cargados
Esperado: 2 gráficos C3.js
- #chart-incidencias-mes: barras (azul + verde)
- #chart-tendencia: línea (naranja + verde)
- Ejes con etiquetas
```

### Caso 5: Filtro período
```
Acción: Cambiar select a "Últimos 3 meses"
Esperado: Requests GET con ?months=3
- Tarjetas actualizan números
- Gráficos muestran solo 3 meses
```

### Caso 6: Permisos
```
Usuario: usuario (no admin)
Acción: Navegar a /#/dashboard-kpi
Esperado: Redirect a login (middleware auth:sanctum)
```

## Impacto

### Performance
- Query COUNT: O(n) en 10k registros
- Agregación por mes: O(n log n)
- Cache: Considerar Redis si dashboard accedido >100x/día
- Sugerencia: Cache 1 hora en Redis

### Permisos
- Requiere: `dashboard.view`
- Roles: admin_sistema, admin_organizacion, operador_sistema
- operador_organizacion: puede ver solo su org

### UX
- Responsive: 4 cols desktop, 2 tablet, 1 mobile
- No requiere refrescar página (filtro vía URL params)
- Gráficos interactivos (hover, zoom)

## Estimación

**Complejidad**: Media  
**Tiempo**: ~4 horas  
**Riesgo**: Bajo  
**Esfuerzo**: 6 puntos

## Notas

- C3.js requiere D3.js (verificar dependencias)
- Usar CDN o npm install c3
- Colores: usar clase Bootstrap (text-primary, etc.)
- Considerar agregar más KPIs (SLA, satisfacción, etc.) en futuro