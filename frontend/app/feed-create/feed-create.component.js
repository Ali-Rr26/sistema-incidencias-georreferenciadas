/**
 * Feed Create Component — formulario para crear incidencias desde el feed.
 *
 * Carga dinámicamente Leaflet, permite seleccionar punto en mapa, y envía
 * POST /api/incidents con el payload correcto.
 */
import { defineComponent } from '../utils/component.js';
import { http } from '../core/http.service.js';
import { auth } from '../auth/auth.service.js';

// ── Leaflet lazy loader ──

function loadLeaflet() {
  if (window.L) return Promise.resolve();

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// ── Helpers ──

function resetFieldError(id) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = '';
    el.classList.add('d-none');
  }
}

function showFieldError(id, msg) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = msg;
    el.classList.remove('d-none');
  }
}

// ── Component ──

export default defineComponent({
  templateUrl: 'app/feed-create/feed-create.component.html',

  async onInit() {
    // ── Chequear autenticación ──
    if (!auth.isAuthenticated()) {
      window.location.hash = '#/login';
      return;
    }

    // ── Cargar datos para selects ──
    let categories = [];
    let locations = [];

    try {
      const catResp = await http.get('/incident-categories?per_page=500');
      categories = catResp.data || catResp;
    } catch {
      // No hay categorías — el form mostrará vacío
    }

    try {
      const locResp = await http.get('/locations/tree');
      locations = locResp.data || locResp;
    } catch {
      // No hay ubicaciones
    }

    // ── Poblar selects ──
    const catSelect = document.getElementById('fc-category');
    categories.forEach((cat) => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = cat.name;
      catSelect.appendChild(opt);
    });

    const locSelect = document.getElementById('fc-location');
    function flattenTree(items, depth = 0) {
      items.forEach((item) => {
        const opt = document.createElement('option');
        opt.value = item.id;
        opt.textContent = '  '.repeat(depth) + item.name;
        locSelect.appendChild(opt);
        if (item.children && item.children.length > 0) {
          flattenTree(item.children, depth + 1);
        }
      });
    }
    flattenTree(locations);
    if (locations.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '-- No hay ubicaciones disponibles --';
      locSelect.appendChild(opt);
    }

    // ── Leaflet map ──
    await loadLeaflet();

    const initialLat = -0.9537;
    const initialLng = -80.7286;

    const mapEl = document.getElementById('fc-map');
    if (!mapEl) return;

    const map = L.map('fc-map').setView([initialLat, initialLng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    let marker = null;
    let geomValue = null; // GeoJSON Point geometry

    function setMarker(lat, lng) {
      if (marker) {
        marker.setLatLng([lat, lng]);
      } else {
        marker = L.marker([lat, lng], { draggable: true }).addTo(map);
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          setMarker(pos.lat, pos.lng);
        });
      }
      geomValue = {
        type: 'Point',
        coordinates: [lng, lat],
      };
      map.setView([lat, lng], map.getZoom());
      resetFieldError('fc-error-geom');
    }

    map.on('click', (e) => setMarker(e.latlng.lat, e.latlng.lng));

    // Forzar recálculo del tamaño del mapa tras montar
    setTimeout(() => map.invalidateSize(), 100);

    // ── Geolocalización ──
    document
      .getElementById('fc-btn-geo')
      .addEventListener('click', function () {
        if (!navigator.geolocation) {
          showFieldError('fc-error-geom', 'Geolocalización no disponible');
          return;
        }
        const btn = this;
        btn.disabled = true;
        btn.innerHTML =
          '<span class="spinner-border spinner-border-sm me-1"></span> Detectando...';

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setMarker(pos.coords.latitude, pos.coords.longitude);
            map.setZoom(16);
            btn.disabled = false;
            btn.innerHTML =
              '<i class="fas fa-location-arrow"></i> Usar mi ubicación';
          },
          () => {
            showFieldError(
              'fc-error-geom',
              'No se pudo obtener la ubicación. Verificá los permisos.',
            );
            btn.disabled = false;
            btn.innerHTML =
              '<i class="fas fa-location-arrow"></i> Usar mi ubicación';
          },
        );
      });

    // ── Submit ──
    document
      .getElementById('fc-form')
      .addEventListener('submit', async function (e) {
        e.preventDefault();

        // Reset errors
        document.querySelectorAll('.fc-field-error').forEach((el) => {
          el.textContent = '';
          el.classList.add('d-none');
        });
        document.getElementById('fc-error').classList.add('d-none');

        const title = document.getElementById('fc-title').value.trim();
        const categoryId = document.getElementById('fc-category').value;
        const priority = document.getElementById('fc-priority').value;
        const description = document.getElementById('fc-description').value.trim();
        const locationId = document.getElementById('fc-location').value;

        // Validación
        let valid = true;

        if (!title) {
          showFieldError('fc-error-title', 'El título es obligatorio');
          valid = false;
        }

        if (!categoryId) {
          showFieldError('fc-error-category', 'Seleccioná una categoría');
          valid = false;
        }

        if (!geomValue) {
          showFieldError(
            'fc-error-geom',
            'Hacé clic en el mapa para seleccionar la ubicación',
          );
          valid = false;
        }

        if (!valid) return;

        // Payload
        const payload = {
          title,
          description: description || null,
          priority,
          incident_category_id: parseInt(categoryId, 10),
          location_id: locationId ? parseInt(locationId, 10) : null,
          geom: geomValue,
        };

        // Loading state
        const submitBtn = document.getElementById('fc-submit');
        submitBtn.disabled = true;
        document.getElementById('fc-submit-text').classList.add('d-none');
        document.getElementById('fc-submit-loading').classList.remove('d-none');

        try {
          await http.post('/incidents', payload);

          // Éxito
          const toastEl = document.createElement('div');
          toastEl.className = 'toast-container position-fixed bottom-0 end-0 p-3';
          toastEl.style.zIndex = '9999';
          toastEl.innerHTML = `
            <div class="toast align-items-center text-bg-success border-0 show" role="alert">
              <div class="d-flex">
                <div class="toast-body">✅ Incidencia publicada correctamente</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
              </div>
            </div>`;
          document.body.appendChild(toastEl);

          setTimeout(() => {
            toastEl.remove();
            window.location.hash = '#/feed';
          }, 2000);
        } catch (err) {
          // 422 — errores de validación
          if (err.status === 422 && err.errors) {
            for (const [field, messages] of Object.entries(err.errors)) {
              const errorEl = document.getElementById(`fc-error-${field}`);
              if (errorEl) {
                errorEl.textContent = Array.isArray(messages)
                  ? messages.join(', ')
                  : messages;
                errorEl.classList.remove('d-none');
              }
            }
            // Mostrar banner general
            const errorBanner = document.getElementById('fc-error');
            if (err.message) {
              errorBanner.textContent = err.message;
              errorBanner.classList.remove('d-none');
            }
          } else if (err.status === 401) {
            window.location.hash = '#/login';
          } else {
            console.error('Error al crear incidencia:', err);
            const errorBanner = document.getElementById('fc-error');
            errorBanner.textContent =
              err.message || 'Error al publicar. Intente de nuevo.';
            errorBanner.classList.remove('d-none');
          }
        } finally {
          submitBtn.disabled = false;
          document.getElementById('fc-submit-text').classList.remove('d-none');
          document.getElementById('fc-submit-loading').classList.add('d-none');
        }
      });
  },

  onDestroy() {
    // Leaflet cleanup — remove map container
    const mapEl = document.getElementById('fc-map');
    if (mapEl && mapEl._leaflet_id) {
      const map = window.L?.DomUtil?.get(mapEl);
      if (map) map.remove();
    }
  },
});
