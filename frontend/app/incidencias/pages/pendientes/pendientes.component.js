import { STATUS_LABEL, escapeHtml } from '../../../utils/format.js';
import { http } from '../../../core/http.service.js';

export default {
  template: `
    <div class="gr-page">
      <!-- Header -->
      <div class="gr-page__header">
        <div>
          <h1 class="gr-page__title">Incidencias Pendientes</h1>
          <nav class="gr-breadcrumb">
            <span class="gr-breadcrumb__item">Gestión</span>
            <span class="gr-breadcrumb__sep">/</span>
            <span class="gr-breadcrumb__item gr-breadcrumb__item--active"
              >Pendientes de verificación</span
            >
          </nav>
          <p class="text-muted mt-1">
            Incidencias sin asignar que coinciden con tu categoría y ubicación.
          </p>
        </div>
      </div>

      <!-- Loading -->
      <div id="pendientes-loading" class="text-center py-5">
        <div class="spinner-border text-primary" role="status"></div>
        <p class="mt-2 text-muted">Cargando incidencias pendientes...</p>
      </div>

      <!-- Error -->
      <div id="pendientes-error" class="d-none">
        <div class="alert alert-danger">
          <i class="fas fa-exclamation-triangle me-2"></i>
          Error al cargar las incidencias pendientes.
          <button
            id="btn-pendientes-reintentar"
            class="btn btn-sm btn-outline-danger ms-3"
          >
            Reintentar
          </button>
        </div>
      </div>

      <!-- Empty -->
      <div id="pendientes-vacio" class="d-none">
        <div class="text-center py-5">
          <i
            class="fas fa-check-circle text-success incid-pendientes__check-icon"
          ></i>
          <h4 class="mt-3">No hay incidencias pendientes</h4>
          <p class="text-muted">
            Todas las incidencias en tu área han sido verificadas o asignadas.
          </p>
        </div>
      </div>

      <!-- List -->
      <div id="pendientes-lista" class="d-none">
        <div class="row g-3" id="pendientes-cards"></div>
      </div>
    </div>

    <!-- Toast -->
    <div class="position-fixed bottom-0 end-0 p-3 incid-pendientes__toast-wrapper">
      <div
        id="pendientes-toast"
        class="toast align-items-center text-white bg-success border-0"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
      >
        <div class="d-flex">
          <div class="toast-body" id="pendientes-toast-msg">
            Incidencia confirmada correctamente.
          </div>
          <button
            type="button"
            class="btn-close btn-close-white me-2 m-auto"
            data-bs-dismiss="toast"
          ></button>
        </div>
      </div>
    </div>
  `,
  async onInit() {
    await cargarPendientes();
    configurarReintento();
  },

  onDestroy() {
    // Cleanup
  },
};

// ── Helpers ────────────────────────────────────────────────

function mostrarEstado(cual) {
  ['loading', 'error', 'vacio', 'lista'].forEach((s) => {
    const el = document.getElementById('pendientes-' + s);
    if (el) el.classList.toggle('d-none', s !== cual);
  });
}

function formatearFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-EC', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Carga de datos ─────────────────────────────────────────

async function cargarPendientes() {
  mostrarEstado('loading');

  try {
    const resp = await http.get('/incidents/pendientes');
    const datos = resp.data ?? resp ?? [];

    if (!datos || datos.length === 0) {
      mostrarEstado('vacio');
      return;
    }

    renderizarLista(datos);
    mostrarEstado('lista');
  } catch (err) {
    console.error('Error al cargar pendientes:', err);
    mostrarEstado('error');
  }
}

function configurarReintento() {
  const btn = document.getElementById('btn-pendientes-reintentar');
  if (btn) {
    btn.addEventListener('click', cargarPendientes);
  }
}

// ── Renderizado ────────────────────────────────────────────

function renderizarLista(incidencias) {
  const container = document.getElementById('pendientes-cards');
  if (!container) return;

  container.innerHTML = incidencias
    .map(
      (inc) => `
    <div class="col-md-6 col-lg-4">
      <div class="gr-card h-100">
        <div style="padding: 20px 24px">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <h5 class="fw-bold mb-0" style="font-size: 1rem">
              ${escapeHtml(inc.title || 'Sin título')}
            </h5>
            <span class="badge bg-secondary">${STATUS_LABEL[inc.status] || inc.status}</span>
          </div>

          <div class="mb-3">
            <div class="d-flex align-items-center text-muted small mb-1">
              <i class="fas fa-tag me-2" style="width: 16px"></i>
              <span>${inc.category?.name || '—'}</span>
            </div>
            <div class="d-flex align-items-center text-muted small mb-1">
              <i class="fas fa-map-marker-alt me-2" style="width: 16px"></i>
              <span>${inc.location?.name || '—'}</span>
            </div>
            <div class="d-flex align-items-center text-muted small">
              <i class="fas fa-calendar me-2" style="width: 16px"></i>
              <span>${formatearFecha(inc.created_at)}</span>
            </div>
          </div>

          <button
            class="btn btn-success w-100 btn-confirmar-pendiente"
            data-id="${inc.id}"
          >
            <i class="fas fa-check-circle me-1"></i>Confirmar
          </button>
        </div>
      </div>
    </div>`,
    )
    .join('');

  // Wire confirm buttons
  container.querySelectorAll('.btn-confirmar-pendiente').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      btn.disabled = true;
      btn.innerHTML =
        '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Confirmando...';

      try {
        await http.post(`/incidents/${id}/confirmar`);
        mostrarToast('Incidencia confirmada correctamente.');
        // Remove card
        const card = btn.closest('.col-md-6');
        card?.remove();
        // Check if list is now empty
        const containerActual = document.getElementById('pendientes-cards');
        if (containerActual && containerActual.children.length === 0) {
          mostrarEstado('vacio');
        }
      } catch (err) {
        mostrarToastError(
          err.message || 'Error al confirmar. Puede que ya haya sido asignada.',
        );
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check-circle me-1"></i>Confirmar';
      }
    });
  });
}

// ── Toast ──────────────────────────────────────────────────

function mostrarToast(msg) {
  const el = document.getElementById('pendientes-toast');
  const msgEl = document.getElementById('pendientes-toast-msg');
  if (msgEl) msgEl.textContent = msg;
  el.className = 'toast align-items-center text-white bg-success border-0';
  new bootstrap.Toast(el, { delay: 3000 }).show();
}

function mostrarToastError(msg) {
  const el = document.getElementById('pendientes-toast');
  const msgEl = document.getElementById('pendientes-toast-msg');
  if (msgEl) msgEl.textContent = msg;
  el.className = 'toast align-items-center text-white bg-danger border-0';
  new bootstrap.Toast(el, { delay: 4000 }).show();
}
