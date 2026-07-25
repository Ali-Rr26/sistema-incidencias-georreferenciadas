# MEJORA-06: Reportar Incidencias Comunes/Repetidas (3 Meses)

**Resumen Ejecutivo**
Crear análisis de incidencias comunes/repetidas en últimos N meses. Agrupar por tipo + subtipo + ubicación. Identificar patrones (zonas problemáticas, tipos frecuentes). Endpoint retorna ranking por frecuencia (count ≥ 3 es "común"). Dashboard con tabla + gráfico de barras. Permite tomar decisiones preventivas.

## Objetivos
- Endpoint `GET /api/dashboard/incidencias-comunes?months=3&location_id={id}`
- Agrupar: incident_type, incident_subtype, location
- Retornar: {tipo, subtipo, ubicacion, count, porcentaje}
- Ordenar DESC por count
- Threshold: count ≥ 3 = "común"
- Frontend: tabla + gráfico barras (Tipo vs Cantidad)
- Filtros: ubicación, rango meses

## Cambios Requeridos

### Backend

**Archivo**: Actualizar `backend/app/Domains/Incidents/Http/DashboardController.php`

```php
public function incidenciasComunes(Request $request): JsonResponse
{
    // GET /api/dashboard/incidencias-comunes
    // Query params: months (int, default 3), location_id (int, optional)
    
    $comunes = $this->service->getIncidenciasComunes(
        months: $request->integer('months', 3),
        locationId: $request->integer('location_id'),
        userId: auth()->id()
    );
    
    return response()->json($comunes);
}
```

**Archivo**: Actualizar `backend/app/Domains/Incidents/Services/DashboardService.php`

```php
public function getIncidenciasComunes(
    int $months = 3,
    int $locationId = null,
    int $userId = null
): array {
    $startDate = now()->subMonths($months)->startOfDay();
    $endDate = now()->endOfDay();
    
    $query = Incident::query()
        ->whereBetween('created_at', [$startDate, $endDate])
        ->selectRaw(
            "incident_type, 
             incident_subtype, 
             location_id,
             COUNT(*) as count,
             ROUND((COUNT(*) * 100.0) / 
                (SELECT COUNT(*) FROM incidents 
                 WHERE created_at BETWEEN ? AND ? 
                 AND organization_id = ? ), 2) as porcentaje"
        );
    
    if ($locationId) {
        $query->where('location_id', $locationId);
    }
    
    // Filtrar por org si operador_organizacion
    if ($userId) {
        $user = \Auth::user();
        $orgId = $user->organization_id ?? 0;
        if ($user->hasRole('operador_organizacion')) {
            $query->where('organization_id', $orgId);
        }
    }
    
    $comunes = $query
        ->groupBy('incident_type', 'incident_subtype', 'location_id')
        ->having(DB::raw('COUNT(*)'), '>=', 3) // Threshold: mínimo 3
        ->orderBy(DB::raw('COUNT(*)'), 'desc')
        ->with(['location', 'category'])
        ->get()
        ->map(fn ($row) => [
            'tipo' => $row->incident_type,
            'subtipo' => $row->incident_subtype,
            'ubicacion' => $row->location?->nombre ?? 'N/A',
            'ubicacion_id' => $row->location_id,
            'count' => $row->count,
            'porcentaje' => $row->porcentaje,
            'riesgo' => $this->calculateRiskLevel($row->count, $row->porcentaje),
        ]);
    
    return [
        'periodo_meses' => $months,
        'fecha_inicio' => $startDate->format('Y-m-d'),
        'fecha_fin' => $endDate->format('Y-m-d'),
        'threshold' => 3,
        'total_incidencias' => Incident::whereBetween('created_at', [$startDate, $endDate])->count(),
        'total_comunes' => $comunes->count(),
        'incidencias_comunes' => $comunes->toArray(),
    ];
}

private function calculateRiskLevel(int $count, float $porcentaje): string
{
    if ($porcentaje >= 20) return 'alto'; // ≥20% = riesgo alto
    if ($porcentaje >= 10) return 'medio'; // 10-20% = riesgo medio
    return 'bajo'; // <10% = riesgo bajo
}
```

**Archivo**: Actualizar rutas `backend/routes/api.php`

```php
Route::middleware('auth:sanctum')->group(function () {
    Route::prefix('dashboard')->group(function () {
        Route::get('/incidencias-comunes', 
            [DashboardController::class, 'incidenciasComunes']);
    });
});
```

### Frontend

**Archivo**: Crear o actualizar `frontend/app/dashboard-kpi/dashboard-kpi.js`

Agregar sección para incidencias comunes:

```javascript
async loadIncidenciasComunes() {
    try {
        const url = new URL(`${API_BASE_URL}/dashboard/incidencias-comunes`);
        url.searchParams.append('months', this.currentMonths);
        if (this.currentLocation) {
            url.searchParams.append('location_id', this.currentLocation);
        }
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        
        const data = await response.json();
        this.renderIncidenciasComunes(data);
    } catch (error) {
        console.error('Error cargando incidencias comunes:', error);
    }
}

renderIncidenciasComunes(data) {
    const container = document.querySelector('#section-incidencias-comunes');
    if (!container) return;
    
    if (data.incidencias_comunes.length === 0) {
        container.innerHTML = `
            <div class="alert alert-info">
                No hay incidencias comunes en este período
            </div>
        `;
        return;
    }
    
    // Tabla
    let tableHtml = `
        <table class="table table-hover">
            <thead>
                <tr>
                    <th>Tipo</th>
                    <th>Subtipo</th>
                    <th>Ubicación</th>
                    <th>Cantidad</th>
                    <th>%</th>
                    <th>Riesgo</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    data.incidencias_comunes.forEach(inc => {
        const badgeClass = this.getRiskBadgeClass(inc.riesgo);
        tableHtml += `
            <tr>
                <td>${escapeHtml(inc.tipo)}</td>
                <td>${escapeHtml(inc.subtipo)}</td>
                <td>${escapeHtml(inc.ubicacion)}</td>
                <td><strong>${inc.count}</strong></td>
                <td>${inc.porcentaje}%</td>
                <td><span class="badge ${badgeClass}">${inc.riesgo}</span></td>
            </tr>
        `;
    });
    
    tableHtml += '</tbody></table>';
    
    container.innerHTML = tableHtml;
    
    // Gráfico
    this.renderGraficoComunes(data);
}

renderGraficoComunes(data) {
    const labels = data.incidencias_comunes.map(inc => 
        `${inc.tipo} - ${inc.subtipo} (${inc.ubicacion})`
    );
    const values = data.incidencias_comunes.map(inc => inc.count);
    
    c3.generate({
        bindto: '#chart-comunes',
        data: {
            columns: [
                ['Incidencias', ...values]
            ],
            type: 'bar'
        },
        axis: {
            x: { 
                label: 'Tipo de Incidencia',
                values: labels
            },
            y: { 
                label: 'Cantidad'
            }
        },
        color: {
            pattern: ['#ff6b6b']
        }
    });
}

getRiskBadgeClass(riesgo) {
    switch (riesgo) {
        case 'alto': return 'bg-danger';
        case 'medio': return 'bg-warning';
        case 'bajo': return 'bg-success';
        default: return 'bg-secondary';
    }
}
```

**Archivo**: Actualizar `frontend/app/dashboard-kpi/dashboard-kpi.html`

Agregar sección:

```html
<!-- Sección Incidencias Comunes -->
<div class="row mt-4">
    <div class="col-md-12">
        <div class="card">
            <div class="card-header">
                <h5>Incidencias Comunes / Repetidas</h5>
                <small class="text-muted">
                    Identificar patrones y zonas problemáticas
                </small>
            </div>
            <div class="card-body">
                <!-- Tabla -->
                <div id="section-incidencias-comunes">
                    <div class="spinner-border" role="status">
                        <span class="visually-hidden">Cargando...</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Gráfico Comunes -->
<div class="row mt-4">
    <div class="col-md-12">
        <div class="card">
            <div class="card-header">
                <h5>Ranking de Incidencias Comunes</h5>
            </div>
            <div class="card-body">
                <div id="chart-comunes" style="height: 350px;"></div>
            </div>
        </div>
    </div>
</div>
```

**Archivo**: Crear página alternativa `frontend/app/dashboard-comunes/dashboard-comunes.js`

```javascript
import { API_BASE_URL, getToken } from '../core/config.js';
import * as c3 from 'https://cdn.jsdelivr.net/npm/c3@0.7.20/+esm';

class DashboardComunes {
    constructor() {
        this.currentLocation = null;
        this.currentMonths = 3;
        this.init();
    }
    
    async init() {
        await this.loadLocations();
        this.setupEventListeners();
        await this.loadComunes();
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
        const select = document.querySelector('#filter-location-comunes');
        select.innerHTML = '<option value="">Todas las ubicaciones</option>';
        
        locations.forEach(loc => {
            const opt = document.createElement('option');
            opt.value = loc.location_id;
            opt.textContent = loc.nombre;
            select.appendChild(opt);
        });
    }
    
    setupEventListeners() {
        document.querySelector('#filter-location-comunes')?.addEventListener('change',
            (e) => this.onLocationChange(e));
        document.querySelector('#filter-months-comunes')?.addEventListener('change',
            (e) => this.onMonthsChange(e));
    }
    
    async onLocationChange(e) {
        this.currentLocation = e.target.value;
        await this.loadComunes();
    }
    
    async onMonthsChange(e) {
        this.currentMonths = parseInt(e.target.value);
        await this.loadComunes();
    }
    
    async loadComunes() {
        try {
            const url = new URL(`${API_BASE_URL}/dashboard/incidencias-comunes`);
            url.searchParams.append('months', this.currentMonths);
            if (this.currentLocation) {
                url.searchParams.append('location_id', this.currentLocation);
            }
            
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            
            const data = await response.json();
            this.renderData(data);
        } catch (error) {
            console.error('Error cargando comunes:', error);
        }
    }
    
    renderData(data) {
        this.renderTable(data.incidencias_comunes);
        this.renderChart(data.incidencias_comunes);
        this.renderStats(data);
    }
    
    renderTable(incidencias) {
        const tbody = document.querySelector('#table-comunes tbody');
        tbody.innerHTML = '';
        
        if (incidencias.length === 0) {
            tbody.innerHTML = `
                <tr><td colspan="6" class="text-center text-muted">
                    Sin incidencias comunes
                </td></tr>
            `;
            return;
        }
        
        incidencias.forEach((inc, idx) => {
            const badgeClass = this.getRiskClass(inc.riesgo);
            const row = `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${escapeHtml(inc.tipo)}</td>
                    <td>${escapeHtml(inc.subtipo)}</td>
                    <td>${escapeHtml(inc.ubicacion)}</td>
                    <td><strong>${inc.count}</strong></td>
                    <td>${inc.porcentaje}%</td>
                    <td><span class="badge ${badgeClass}">${inc.riesgo}</span></td>
                </tr>
            `;
            tbody.insertAdjacentHTML('beforeend', row);
        });
    }
    
    renderChart(incidencias) {
        const top10 = incidencias.slice(0, 10);
        const labels = top10.map(inc => 
            `${inc.tipo}\n${inc.subtipo}\n${inc.ubicacion}`
        );
        const values = top10.map(inc => inc.count);
        
        c3.generate({
            bindto: '#chart-comunes-detail',
            data: {
                columns: [['Cantidad', ...values]],
                type: 'bar'
            },
            axis: {
                x: { 
                    label: 'Tipo - Subtipo - Ubicación',
                    values: labels,
                    tick: { rotate: 45 }
                },
                y: { 
                    label: 'Cantidad de Incidencias'
                }
            },
            color: {
                pattern: ['#ff6b6b']
            }
        });
    }
    
    renderStats(data) {
        const statsDiv = document.querySelector('#comunes-stats');
        statsDiv.innerHTML = `
            <div class="row">
                <div class="col-md-3">
                    <div class="stat-card">
                        <div class="stat-value">${data.total_incidencias}</div>
                        <div class="stat-label">Total incidencias</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="stat-card">
                        <div class="stat-value">${data.total_comunes}</div>
                        <div class="stat-label">Patrones identificados</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="stat-card">
                        <div class="stat-value">
                            ${Math.round((data.total_comunes / data.total_incidencias) * 100)}%
                        </div>
                        <div class="stat-label">% de comunes</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="stat-card">
                        <div class="stat-value">${data.periodo_meses}</div>
                        <div class="stat-label">Período (meses)</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    getRiskClass(riesgo) {
        switch (riesgo) {
            case 'alto': return 'bg-danger text-white';
            case 'medio': return 'bg-warning text-dark';
            case 'bajo': return 'bg-success text-white';
            default: return 'bg-secondary text-white';
        }
    }
}

export default DashboardComunes;
```

**Archivo**: Crear `frontend/app/dashboard-comunes/dashboard-comunes.html`

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
                    <h1 class="page-title">Análisis - Incidencias Comunes</h1>
                </div>
            </div>
        </div>
        
        <!-- Filtros -->
        <div class="container-fluid mb-4">
            <div class="row">
                <div class="col-md-6">
                    <label for="filter-location-comunes">Ubicación</label>
                    <select id="filter-location-comunes" class="form-control">
                        <option value="">Cargando...</option>
                    </select>
                </div>
                <div class="col-md-6">
                    <label for="filter-months-comunes">Período</label>
                    <select id="filter-months-comunes" class="form-control">
                        <option value="1">Último mes</option>
                        <option value="3" selected>Últimos 3 meses</option>
                        <option value="6">Últimos 6 meses</option>
                        <option value="12">Último año</option>
                    </select>
                </div>
            </div>
        </div>
        
        <!-- Estadísticas -->
        <div class="container-fluid mb-4">
            <div id="comunes-stats">
                <!-- Stats renderizados -->
            </div>
        </div>
        
        <!-- Tabla -->
        <div class="container-fluid mb-4">
            <div class="row">
                <div class="col-md-12">
                    <div class="card">
                        <div class="card-header">
                            <h5>Incidencias Comunes Detectadas</h5>
                            <small class="text-muted">
                                Mínimo 3 ocurrencias en el período
                            </small>
                        </div>
                        <div class="card-body">
                            <div class="table-responsive">
                                <table id="table-comunes" class="table table-hover">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Tipo</th>
                                            <th>Subtipo</th>
                                            <th>Ubicación</th>
                                            <th>Cantidad</th>
                                            <th>%</th>
                                            <th>Riesgo</th>
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
        
        <!-- Gráfico -->
        <div class="container-fluid">
            <div class="row">
                <div class="col-md-12">
                    <div class="card">
                        <div class="card-header">
                            <h5>Top 10 Incidencias Comunes</h5>
                        </div>
                        <div class="card-body">
                            <div id="chart-comunes-detail" style="height: 400px;"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<style>
    .stat-card {
        background: white;
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 20px;
        text-align: center;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    .stat-value {
        font-size: 2rem;
        font-weight: bold;
        color: #333;
    }
    
    .stat-label {
        color: #999;
        margin-top: 10px;
        font-size: 0.9rem;
    }
</style>

<script src="../assets/libs/jquery/dist/jquery.min.js"></script>
<script src="../assets/libs/popper.js/dist/umd/popper.min.js"></script>
<script src="../assets/libs/bootstrap/dist/js/bootstrap.min.js"></script>
<script src="https://unpkg.com/feather-icons/dist/feather.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/c3@0.7.20/+esm"></script>

<script type="module">
    import DashboardComunes from './dashboard-comunes.js';
    document.addEventListener('DOMContentLoaded', () => {
        new DashboardComunes();
        feather.replace();
        $('.preloader').fadeOut(500);
    });
</script>
```

**Archivo**: Actualizar `frontend/app/app.js`

```javascript
{
    path: '/dashboard-comunes',
    component: () => import('./dashboard-comunes/dashboard-comunes.html'),
    requireAuth: true,
    meta: { title: 'Incidencias Comunes' }
}
```

### Base de Datos

No requiere cambios. Usa tablas existentes:
- `incidents` (con campos incident_type, incident_subtype, location_id)
- `locations`

Verificar que existan índices para performance:
```sql
CREATE INDEX idx_incidents_type_subtype_location 
ON incidents(incident_type, incident_subtype, location_id, created_at);
```

## Archivos Afectados

| Ruta | Cambio |
|------|--------|
| `backend/app/Domains/Incidents/Http/DashboardController.php` | Agregar método incidenciasComunes() |
| `backend/app/Domains/Incidents/Services/DashboardService.php` | Agregar getIncidenciasComunes() + calculateRiskLevel() |
| `backend/routes/api.php` | Agregar ruta /dashboard/incidencias-comunes |
| `frontend/app/dashboard-kpi/dashboard-kpi.js` | Agregar sección incidencias comunes |
| `frontend/app/dashboard-kpi/dashboard-kpi.html` | Agregar tabla + gráfico |
| `frontend/app/dashboard-comunes/dashboard-comunes.js` | Crear nuevo |
| `frontend/app/dashboard-comunes/dashboard-comunes.html` | Crear nuevo |
| `frontend/app/app.js` | Registrar ruta |

## Pasos de Implementación Detallados

### 1. Backend

**Paso 1.1**: Actualizar DashboardController
```bash
cd backend
# Agregar método:
public function incidenciasComunes(Request $request): JsonResponse
```

**Paso 1.2**: Actualizar DashboardService
```php
// Agregar métodos:
// - getIncidenciasComunes()
// - calculateRiskLevel()

// Usar GROUP BY + HAVING para filtrar comunes
// Usar selectRaw para porcentaje calculado
```

**Paso 1.3**: Registrar ruta
```php
// routes/api.php
Route::get('/dashboard/incidencias-comunes', 
    [DashboardController::class, 'incidenciasComunes']);
```

**Paso 1.4**: Test endpoint
```bash
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:8000/api/dashboard/incidencias-comunes?months=3&location_id=1"

# Debe retornar JSON con incidencias_comunes ordenadas por count DESC
```

### 2. Frontend

**Paso 2.1**: Crear módulo dashboard-comunes
```bash
cd frontend
mkdir -p app/dashboard-comunes
touch app/dashboard-comunes/dashboard-comunes.js
touch app/dashboard-comunes/dashboard-comunes.html
```

**Paso 2.2**: Implementar DashboardComunes
```javascript
// Cargar comunes
// Renderizar tabla
// Renderizar gráfico C3.js
// Mostrar stats
```

**Paso 2.3**: Registrar ruta
```javascript
// app/app.js
{
    path: '/dashboard-comunes',
    component: () => import('./dashboard-comunes/dashboard-comunes.html'),
    requireAuth: true
}
```

**Paso 2.4**: Agregar a KPI dashboard
```html
<!-- En dashboard-kpi.html -->
<!-- Agregar sección de incidencias comunes -->
```

**Paso 2.5**: Agregar a sidebar
```html
<li><a href="/#/dashboard-comunes">Incidencias Comunes</a></li>
```

**Paso 2.6**: Test en browser
```bash
npm run dev

# 1. Navegar a /#/dashboard-comunes
# 2. Seleccionar ubicación
# 3. Tabla muestra incidencias comunes (count ≥ 3)
# 4. Gráfico muestra top 10 ordenado por cantidad
# 5. Cambiar período → actualiza
```

## Testing

### Caso 1: Endpoint incidencias-comunes
```
GET /api/dashboard/incidencias-comunes?months=3&location_id=1
Usuario: admin_sistema
Esperado: 200 OK
- incidencias_comunes[]: array ordenado DESC por count
- Cada item: tipo, subtipo, ubicacion, count (≥3), porcentaje, riesgo
- riesgo: "alto" (≥20%), "medio" (10-20%), "bajo" (<10%)
```

### Caso 2: Filtro sin ubicación
```
GET /api/dashboard/incidencias-comunes?months=6
Usuario: operador_organizacion (org_id=2)
Esperado: 200 OK
- Incidencias solo de esa org
- Sin filtro location_id
```

### Caso 3: Tabla ranking
```
Acción: Cargar /#/dashboard-comunes
Esperado:
- Tabla con columnas: #, Tipo, Subtipo, Ubicación, Cantidad, %, Riesgo
- Ordenada DESC por Cantidad
- Badges de riesgo: rojo (alto), amarillo (medio), verde (bajo)
```

### Caso 4: Gráfico barras
```
Acción: Datos cargados
Esperado:
- Gráfico C3.js de barras
- Eje X: Tipo - Subtipo - Ubicación
- Eje Y: Cantidad
- Top 10 incidencias comunes
```

### Caso 5: Estadísticas
```
Acción: Cargar datos
Esperado: 4 tarjetas visibles
- Total incidencias
- Patrones identificados (comunes count)
- % de comunes
- Período (meses)
```

### Caso 6: Filtro período
```
Acción: Cambiar a "Últimos 6 meses"
Esperado:
- GET con ?months=6
- Tabla y gráfico actualizan
- Stats recalculan
```

## Impacto

### Performance
- Query: GROUP BY + HAVING en Incident (puede ser costoso con muchos datos)
- Índice recomendado: (incident_type, incident_subtype, location_id, created_at)
- Cache: Considerar Redis 1 hora si dashboard muy accedido

### Permisos
- Requiere: `dashboard.view`
- Roles: admin_sistema, operador_sistema, admin_organizacion, operador_organizacion

### Análisis
- Threshold: count ≥ 3 es "común"
- Riesgo: Basado en porcentaje del total
- Permite tomar decisiones preventivas

## Estimación

**Complejidad**: Media  
**Tiempo**: ~3-4 horas  
**Riesgo**: Bajo  
**Esfuerzo**: 5 puntos

## Notas

- Threshold (3) puede ajustarse en futuro (configuración)
- Considerar ML para predictive analytics (futuro)
- Agregar exportación a CSV (futuro)
- Considerar notificaciones cuando surgen nuevos patrones (futuro)
- Risk level calculation puede ser más sofisticado (incluir impacto, urgencia, etc.)