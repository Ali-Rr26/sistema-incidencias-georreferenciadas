import { defineComponent } from '../../../utils/component.js';
import { http } from '../../../core/http.service.js';

// ─────────────────────────────────────────────
// Carga D3 + C3 de forma lazy (ya están en assets)
// ─────────────────────────────────────────────
function loadC3() {
  if (window.c3) return Promise.resolve();

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'assets/extra-libs/c3/c3.min.css';
  document.head.appendChild(link);

  return new Promise((resolve, reject) => {
    const d3 = document.createElement('script');
    d3.src = 'assets/extra-libs/c3/d3.min.js';
    d3.onload = () => {
      const c3 = document.createElement('script');
      c3.src = 'assets/extra-libs/c3/c3.min.js';
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
// Componente
// ─────────────────────────────────────────────
export default defineComponent({
  templateUrl: 'app/dashboard/pages/dashboard/dashboard.component.html',
  styleUrl: 'app/dashboard/pages/dashboard/dashboard.component.css',

  async onInit() {
    // C3, stats y feed de actividad en paralelo — todo falla silenciosamente
    const [, statsResult, feedResult] = await Promise.allSettled([
      loadC3(),
      http.get('/incidents/stats'),
      http.get('/incidents?per_page=5'),
    ]);

    const stats = statsResult.status === 'fulfilled' ? (statsResult.value ?? {}) : {};
    const byStatus = stats.by_status ?? {};
    const total = stats.total ?? 0;
    const pendientes = byStatus.pending ?? 0;
    const en_proceso = byStatus.in_progress ?? 0;
    const resueltas = byStatus.resolved ?? 0;
    const ubicaciones = stats.locations_count ?? 0;

    // Counters animados
    animateCounter(document.getElementById('stat-incidencias'), total);
    animateCounter(document.getElementById('stat-pendientes'), pendientes);
    animateCounter(document.getElementById('stat-resueltas'), resueltas);
    animateCounter(document.getElementById('stat-ubicaciones'), ubicaciones);

    // Badges de porcentaje (pendientes / total)
    if (total > 0) {
      const pctPend = Math.round((pendientes / total) * 100);
      const pctRes = Math.round((resueltas / total) * 100);
      const badgePend = document.getElementById('badge-pendientes');
      const badgeRes = document.getElementById('badge-resueltas');
      if (badgePend && pctPend > 0) badgePend.textContent = pctPend + '%';
      if (badgeRes && pctRes > 0) badgeRes.textContent = pctRes + '%';
    }

    // Leyenda del gráfico
    const setEl = (id, v) => {
      const e = document.getElementById(id);
      if (e) e.textContent = v;
    };
    setEl('legend-pendientes', pendientes);
    setEl('legend-en-proceso', en_proceso);
    setEl('legend-resueltas', resueltas);

    // Donut C3
    initDonut(pendientes, en_proceso, resueltas, total);

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
});
