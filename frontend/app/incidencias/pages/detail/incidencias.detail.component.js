import { defineComponent } from '../../../utils/component.js';
import { http } from '../../../core/http.service.js';

const STATUS_LABEL = {
  pending: 'Pendiente',
  in_progress: 'En proceso',
  resolved: 'Resuelto',
};

const PRIORITY_LABEL = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

export default defineComponent({
  templateUrl: 'app/incidencias/pages/detail/incidencias.detail.component.html',

  async onInit() {
    const params = window.__router.routeParams ?? {};
    const id = params.id;
    if (!id) {
      window.location.hash = '#/incidencias';
      return;
    }

    this._incidentId = id;
    const inc = await cargarIncidencia(id);
    renderizarIncidencia(inc);
    renderizarImagenes(inc.images ?? []);
    setupUpload(id);
  },

  onDestroy() {
    const mapEl = document.getElementById('detalle-coords');
    if (mapEl) {
      delete mapEl._leaflet_map;
    }
  },
});

async function cargarIncidencia(id) {
  document.getElementById('detalle-loading').classList.remove('d-none');
  document.getElementById('detalle-content').classList.add('d-none');

  try {
    const resp = await http.get(`/incidents/${id}`);
    const inc = resp.data ?? resp;
    return inc;
  } catch (err) {
    console.error('Error al cargar incidencia:', err);
    document.getElementById('detalle-loading').innerHTML = `
      <div class="alert alert-danger">
        <i class="fas fa-exclamation-triangle me-2"></i>
        Error al cargar la incidencia. <a href="#/incidencias" class="alert-link">Volver</a>
      </div>`;
    throw err;
  }
}

function renderizarIncidencia(inc) {
  document.getElementById('detalle-loading').classList.add('d-none');
  document.getElementById('detalle-content').classList.remove('d-none');

  document.getElementById('detalle-titulo').textContent =
    inc.title ?? 'Sin título';
  document.getElementById('detalle-breadcrumb').textContent =
    inc.title ?? 'Detalle';

  // Thumbnail del incidente (proxy URL)
  const thumbnailContainer = document.getElementById('detalle-thumbnail');
  if (inc.thumbnail_url) {
    thumbnailContainer.innerHTML = `
      <img src="${inc.thumbnail_url}" alt="Thumbnail" class="img-fluid rounded" style="max-height:180px;width:100%;object-fit:cover;" />
    `;
    thumbnailContainer.classList.remove('d-none');
  }

  const statusEl = document.getElementById('detalle-status');
  statusEl.textContent = STATUS_LABEL[inc.status] ?? inc.status;
  statusEl.className = `ig-status-badge ig-status-${inc.status}`;

  document.getElementById('detalle-priority').textContent =
    PRIORITY_LABEL[inc.priority] ?? inc.priority;
  document.getElementById('detalle-fecha').textContent = inc.created_at
    ? new Date(inc.created_at).toLocaleDateString('es-EC', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
  document.getElementById('detalle-descripcion').textContent =
    inc.description ?? 'Sin descripción';
  document.getElementById('detalle-categoria').textContent =
    inc.category?.name ?? '—';
  document.getElementById('detalle-ubicacion').textContent =
    inc.location?.name ?? '—';
  document.getElementById('detalle-usuario').textContent = inc.user
    ? [inc.user.first_name, inc.user.last_name].filter(Boolean).join(' ')
    : '—';
  document.getElementById('detalle-organizacion').textContent =
    inc.organization?.name ?? '—';

  renderMap(inc);
}

function renderMap(inc) {
  const mapEl = document.getElementById('detalle-coords');
  if (inc.geom?.coordinates) {
    const [lng, lat] = inc.geom.coordinates;
    const link = document.createElement('a');
    link.href = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
    link.target = '_blank';
    link.className = 'btn btn-outline-primary btn-sm';
    link.innerHTML =
      '<i class="fas fa-external-link-alt me-1"></i>Ver en OpenStreetMap';
    mapEl.innerHTML = `
      <div class="text-center py-4">
        <p class="mb-2"><strong>Coordenadas:</strong> ${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
      </div>`;
    mapEl.appendChild(link);
  } else {
    mapEl.innerHTML =
      '<p class="text-muted text-center py-4 mb-0">Sin coordenadas</p>';
  }
}

function renderizarImagenes(images) {
  const container = document.getElementById('detalle-imagenes');
  const emptyEl = document.getElementById('detalle-sin-imagenes');

  if (!images || images.length === 0) {
    emptyEl?.classList.remove('d-none');
    return;
  }

  emptyEl?.classList.add('d-none');
  container.innerHTML = images
    .map(
      (img) => `
    <div class="mb-2 position-relative">
      <a href="${img.url}" target="_blank">
        <img src="${img.url}" alt="${img.original_name}" class="img-fluid rounded" style="width:100%;max-height:200px;object-fit:cover;" />
      </a>
      <small class="text-muted d-block text-truncate mt-1">${img.original_name}</small>
    </div>`,
    )
    .join('');
}

function setupUpload(incidentId) {
  const fileInput = document.getElementById('detalle-file-input');
  const btnSubir = document.getElementById('btn-subir-imagen');
  const progress = document.getElementById('detalle-upload-progress');

  btnSubir.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) return;

    btnSubir.disabled = true;
    progress.classList.remove('d-none');

    try {
      const formData = new FormData();
      formData.append('images[]', file);

      // Upload via PATCH to the incident endpoint
      const resp = await http.request(
        'PATCH',
        `/incidents/${incidentId}`,
        formData,
      );

      fileInput.value = '';
      btnSubir.disabled = true;
      progress.classList.add('d-none');

      const toast = new bootstrap.Toast(
        document.getElementById('toast-imagen'),
        { delay: 2000 },
      );
      toast.show();

      // Refresh images from the updated incident
      const images = resp.data?.images ?? [];
      renderizarImagenes(images);
    } catch (err) {
      console.error('Error al subir imagen:', err);
      alert(
        'Error al subir la imagen. Verifique que sea JPEG, PNG o WEBP y que no supere 10 MB.',
      );
    } finally {
      btnSubir.disabled = false;
      progress.classList.add('d-none');
    }
  });
}
