import template from './dashboard.component.html?raw';
import style from './dashboard.component.css?raw';
import { http } from '../../../core/http.service.js';

// ─────────────────────────────────────────────
// Estado global de filtros
// ─────────────────────────────────────────────
const filterState = {
  inicio: null,
  fin: null,
  tipo_id: null,
  ciudad_id: null,
  provincia_id: null,
  pais_id: null,
  locationTree: [],
  categories: [],
};

// ─────────────────────────────────────────────
// Carga D3 + C3 de forma lazy (ya están en assets)
// ─────────────────────────────────────────────
function loadC3() {
  if (window.c3) return Promise.resolve();

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/assets/extra-libs/c3/c3.min.css';
  document.head.appendChild(link);

  return new Promise((resolve, reject) => {
    const d3 = document.createElement('script');
    d3.src = '/assets/extra-libs/c3/d3.min.js';
    d3.onload = () => {
      const c3 = document.createElement('script');
      c3.src = '/assets/extra-libs/c3/c3.min.js';
      c3.onload = resolve;
      c3.onerror = reject;
      document.head.appendChild(c3);
    };
    d3.onerror = reject;
    document.head.appendChild(d3);
  });
}

// ─────────────────────────────────────────────
// Counter animation — cuenta desde 0 al valor final
// ─────────────────────────────────────────────
function animateCounter(el, target, duration = 900) {
  if (!el || target === 0) {
    if (el) el.textContent = 0;
    return;
  }
  const start = Date.now();
  const tick = () => {
    const elapsed = Date.now() - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    el.textContent = Math.round(eased * target);
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ─────────────────────────────────────────────
// Donut chart — incidencias por estado (C3.js)
// ─────────────────────────────────────────────
function initDonut(pendientes, en_proceso, resueltas, total) {
  if (!window.c3 || !document.getElementById('chart-estados')) return;

  // Si no hay datos, mostrar el donut vacío con un placeholder
  const cols =
    total > 0
      ? [
          ['Pendientes', pendientes],
          ['En proceso', en_proceso],
          ['Resueltas', resueltas],
        ]
      : [['Sin datos', 1]];

  const colors =
    total > 0
      ? { pattern: ['#ffaf01', '#5f76e8', '#22ca80'] }
      : { pattern: ['#e9ecef'] };

  c3.generate({
    bindto: '#chart-estados',
    data: { columns: cols, type: 'donut' },
    donut: {
      label: { show: false },
      title: String(total),
      width: 22,
    },
    legend: { hide: true },
    color: colors,
  });
}

// ─────────────────────────────────────────────
// Activity feed — incidencias recientes
// ─────────────────────────────────────────────
const PRIORIDAD_BTN = {
  high: 'btn-danger',
  medium: 'btn-warning',
  low: 'btn-info',
};
const PRIORIDAD_ICON = {
  high: 'alert-triangle',
  medium: 'alert-circle',
  low: 'info',
};

function buildActivityFeed(items) {
  const feed = document.getElementById('activity-feed');
  if (!feed || !items || items.length === 0) return;

  document.getElementById('activity-empty')?.remove();

  items.slice(0, 5).forEach((inc, idx) => {
    const isLast = idx === Math.min(items.length, 5) - 1;
    const btnClass = PRIORIDAD_BTN[inc.priority] || 'btn-primary';
    const iconName = PRIORIDAD_ICON[inc.priority] || 'map-pin';
    const fecha = inc.created_at
      ? new Date(inc.created_at).toLocaleDateString('es-EC', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : '';
    const categoria = inc.category?.name || '';

    const item = document.createElement('div');
    item.className = `d-flex align-items-start${isLast ? '' : ' border-left-line pb-3'}`;
    item.innerHTML = `
      <div>
        <a href="#/incidencias" class="btn ${btnClass} btn-circle mb-2 btn-item">
          <i data-feather="${iconName}"></i>
        </a>
      </div>
      <div class="ms-3 mt-2">
        <h5 class="text-dark font-weight-medium mb-1">${categoria || 'Sin título'}</h5>
        <p class="font-12 mb-1 text-muted">${inc.status?.replace('_', ' ') || ''} — ${inc.priority}</p>
        <span class="font-12 text-muted">${fecha}</span>
      </div>`;
    feed.appendChild(item);
  });

  if (window.feather) feather.replace();
}

// ─────────────────────────────────────────────
// Tiempo promedio de resolución (R: "Average Resolution Time Format")
// El backend devuelve { days, hours, seconds, formatted } o null cuando
// no hay incidencias resueltas todavía.
// ─────────────────────────────────────────────
function formatResolutionTime(avg) {
  if (!avg) return 'Sin datos';
  const { days, hours } = avg;
  if (days > 0 && hours > 0) return `${days}d ${hours}h`;
  if (days > 0) return `${days}d`;
  return `${hours}h`;
}

// ─────────────────────────────────────────────
// Carga stats con filtros aplicados
// ─────────────────────────────────────────────
async function loadStats() {
  const params = new URLSearchParams();
  if (filterState.inicio) params.append('inicio', filterState.inicio);
  if (filterState.fin) params.append('fin', filterState.fin);
  if (filterState.tipo_id) params.append('tipo_id', filterState.tipo_id);
  if (filterState.ciudad_id) params.append('ciudad_id', filterState.ciudad_id);
  if (filterState.provincia_id)
    params.append('provincia_id', filterState.provincia_id);
  if (filterState.pais_id) params.append('pais_id', filterState.pais_id);

  const query = params.toString();
  try {
    const stats = await http.get(
      query ? `/incidents/stats?${query}` : '/incidents/stats',
    );
    return stats ?? {};
  } catch (e) {
    console.error('Error loading stats:', e);
    return {};
  }
}

// ─────────────────────────────────────────────
// Actualiza el dashboard con nuevos datos
// ─────────────────────────────────────────────
async function refreshDashboard() {
  const stats = await loadStats();
  const byStatus = stats.by_status ?? {};
  const total = stats.total ?? 0;
  const pendientes = byStatus.pending ?? 0;
  const en_proceso = byStatus.in_progress ?? 0;
  const resueltas = byStatus.resolved ?? 0;
  const ubicaciones = stats.locations_count ?? 0;
  const tiempoResolucion = stats.average_resolution_time ?? null;

  // Re-animar counters
  animateCounter(document.getElementById('stat-incidencias'), total);
  animateCounter(document.getElementById('stat-pendientes'), pendientes);
  animateCounter(document.getElementById('stat-resueltas'), resueltas);
  animateCounter(document.getElementById('stat-ubicaciones'), ubicaciones);

  // Tiempo promedio
  const resolucionEl = document.getElementById('stat-tiempo-resolucion');
  if (resolucionEl) {
    resolucionEl.textContent = formatResolutionTime(tiempoResolucion);
  }

  // Badges
  if (total > 0) {
    const pctPend = Math.round((pendientes / total) * 100);
    const pctRes = Math.round((resueltas / total) * 100);
    const badgePend = document.getElementById('badge-pendientes');
    const badgeRes = document.getElementById('badge-resueltas');
    if (badgePend && pctPend > 0) badgePend.textContent = pctPend + '%';
    if (badgeRes && pctRes > 0) badgeRes.textContent = pctRes + '%';
  }

  // Leyenda
  const setEl = (id, v) => {
    const e = document.getElementById(id);
    if (e) e.textContent = v;
  };
  setEl('legend-pendientes', pendientes);
  setEl('legend-en-proceso', en_proceso);
  setEl('legend-resueltas', resueltas);

  // Re-inicializar gráfico
  initDonut(pendientes, en_proceso, resueltas, total);

  // Cerrar modal de filtros si está abierto
  const modal = bootstrap?.Modal?.getOrCreateInstance?.(
    document.getElementById('filter-modal'),
  );
  if (modal) modal.hide();
}

// ─────────────────────────────────────────────
// Setup de event listeners para filtros
// ─────────────────────────────────────────────
function setupFilterListeners() {
  // Cargar árbol de ubicaciones y categorías
  Promise.all([
    http.get('/locations/tree'),
    http.get('/incident-categories/tree'),
  ])
    .then(([locTree, catTree]) => {
      filterState.locationTree = locTree ?? [];
      filterState.categories = catTree ?? [];
    })
    .catch(() => {
      console.warn('Failed to load filter options');
    });

  // Botón "Aplicar" — ejecuta refreshDashboard
  const btnAplicar = document.getElementById('btn-filter-apply');
  if (btnAplicar) {
    btnAplicar.addEventListener('click', refreshDashboard);
  }

  // Input fecha inicio
  const inputInicio = document.getElementById('filter-inicio');
  if (inputInicio) {
    inputInicio.addEventListener('change', (e) => {
      filterState.inicio = e.target.value;
    });
  }

  // Input fecha fin
  const inputFin = document.getElementById('filter-fin');
  if (inputFin) {
    inputFin.addEventListener('change', (e) => {
      filterState.fin = e.target.value;
    });
  }

  // Select tipo
  const selectTipo = document.getElementById('filter-tipo');
  if (selectTipo) {
    // Poblar con categorías raíz
    filterState.categories
      .filter((c) => !c.parent_id)
      .forEach((cat) => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = cat.name;
        selectTipo.appendChild(opt);
      });
    selectTipo.addEventListener('change', (e) => {
      filterState.tipo_id = e.target.value
        ? parseInt(e.target.value, 10)
        : null;
    });
  }

  // Select país (para ubicación)
  const selectPais = document.getElementById('filter-pais');
  if (selectPais) {
    // Poblar con raíces (países)
    filterState.locationTree
      .filter((l) => !l.parent_id)
      .forEach((loc) => {
        const opt = document.createElement('option');
        opt.value = loc.id;
        opt.textContent = loc.name;
        selectPais.appendChild(opt);
      });
    selectPais.addEventListener('change', (e) => {
      filterState.pais_id = e.target.value
        ? parseInt(e.target.value, 10)
        : null;
      // Limpiar provincia y ciudad
      filterState.provincia_id = null;
      filterState.ciudad_id = null;
      const selectProvia = document.getElementById('filter-provincia');
      if (selectProvia) {
        selectProvia.innerHTML =
          '<option value="">-- Seleccione provincia --</option>';
        selectProvia.disabled = !filterState.pais_id;
      }
      const selectCiudad = document.getElementById('filter-ciudad');
      if (selectCiudad) {
        selectCiudad.innerHTML =
          '<option value="">-- Seleccione ciudad --</option>';
        selectCiudad.disabled = true;
      }
      // Poblar provincia si país seleccionado
      if (filterState.pais_id) {
        const pais = filterState.locationTree.find(
          (l) => l.id === filterState.pais_id,
        );
        if (pais && pais.children) {
          pais.children.forEach((prov) => {
            const opt = document.createElement('option');
            opt.value = prov.id;
            opt.textContent = prov.name;
            selectProvia.appendChild(opt);
          });
        }
      }
    });
  }

  // Select provincia
  const selectProvia = document.getElementById('filter-provincia');
  if (selectProvia) {
    selectProvia.addEventListener('change', (e) => {
      filterState.provincia_id = e.target.value
        ? parseInt(e.target.value, 10)
        : null;
      filterState.ciudad_id = null;
      const selectCiudad = document.getElementById('filter-ciudad');
      if (selectCiudad) {
        selectCiudad.innerHTML =
          '<option value="">-- Seleccione ciudad --</option>';
        selectCiudad.disabled = !filterState.provincia_id;
      }
      // Poblar ciudad si provincia seleccionada
      if (filterState.provincia_id) {
        const prov = filterState.locationTree
          .flatMap((p) => p.children || [])
          .find((c) => c.id === filterState.provincia_id);
        if (prov && prov.children) {
          prov.children.forEach((ciudad) => {
            const opt = document.createElement('option');
            opt.value = ciudad.id;
            opt.textContent = ciudad.name;
            selectCiudad.appendChild(opt);
          });
        }
      }
    });
  }

  // Select ciudad
  const selectCiudad = document.getElementById('filter-ciudad');
  if (selectCiudad) {
    selectCiudad.addEventListener('change', (e) => {
      filterState.ciudad_id = e.target.value
        ? parseInt(e.target.value, 10)
        : null;
    });
  }
}

// ─────────────────────────────────────────────
// Export dropdown — hits GET /api/incidents/exportar with the active
// filterState. Browsers start the download via a temporary anchor so
// the user stays on the dashboard (no navigation).
// ─────────────────────────────────────────────
function setupExportListeners() {
  document.querySelectorAll('[data-export-format]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const format = e.currentTarget.dataset.exportFormat;
      if (!format) return;

      const params = new URLSearchParams();
      params.set('format', format);
      for (const [key, value] of Object.entries(filterState)) {
        if (value !== null && value !== undefined && value !== '') {
          params.set(key, String(value));
        }
      }

      triggerDownload(`/api/incidents/exportar?${params.toString()}`);
    });
  });
}

async function triggerDownload(url) {
  try {
    // Reuse the shared http service so JWT header / refresh flow is
    // identical to every other dashboard call. `responseType: 'blob'`
    // tells the service not to JSON-parse.
    const blob = await http.get(url, { responseType: 'blob' });
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    // The server sets the filename via Content-Disposition, but a
    // fallback here keeps the file usable when the header is stripped
    // (e.g. some corporate proxies).
    a.download = url.split('?')[0].split('/').pop() || 'reporte';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch (err) {
    console.error('Error al exportar:', err);
    // Fallback: full navigation triggers the download via the
    // browser's native download manager even if the blob fetch fails
    // (e.g. large PDFs that exceed the in-memory buffer budget).
    window.location.assign(url);
  }
}

// ─────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────
export default {
  template,
  style,

  async onInit() {
    // C3 y feed de actividad en paralelo
    const [, feedResult] = await Promise.allSettled([
      loadC3(),
      http.get('/incidents?per_page=5'),
    ]);

    // Setup de filtros (carga listener e inicializa opciones)
    setupFilterListeners();
    setupExportListeners();

    // Cargar stats iniciales (sin filtros)
    await refreshDashboard();

    // Activity feed — últimas 5 incidencias (independiente de stats)
    try {
      const resp =
        feedResult.status === 'fulfilled' ? (feedResult.value ?? {}) : {};
      const items =
        resp.data ?? resp.items ?? (Array.isArray(resp) ? resp : []);
      buildActivityFeed(items);
    } catch {
      /* mantener estado vacío */
    }
  },

  onDestroy() {},
};
