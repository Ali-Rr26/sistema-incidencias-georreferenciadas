/**
 * Unified Create Incident Form
 *
 * Single responsive template — CSS grid reflows fields 1-col → 2-col ≥ 992px.
 * No shell-based context detection; all elements use the `ici-` prefix.
 */

import { http } from '../../../core/http.service.js';
import { router } from '../../../core/router.js';
import initMapView from '../../../shared/init-map-view.js';

// ── Error field mapping: backend field → error ID suffix ──
const ERROR_MAP = {
  title: 'error-title',
  description: 'error-description',
  priority: 'error-priority',
  incident_category_id: 'error-category',
  geom: 'error-geom',
  location_id: 'error-location',
};

const P = 'ici-';
const $ = (suffix) => document.getElementById(P + suffix);

export default {
  templateUrl: 'app/incidencias/pages/form/incidencias.form.component.html',
  styleUrl: 'app/incidencias/pages/form/incidencias.form.component.css',

  async onInit() {
    document.body.classList.add('ici-create-view');

    // ── State ──
    let marker = null;
    let geomValue = null; // GeoJSON Point
    let imagenesSeleccionadas = [];
    let categories = [];
    let locationsTree = [];

    // ── Helpers ──

    function resetFieldError(id) {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = '';
        // `incid-form__map-error` keeps its font-size + hidden-by-default
        // styling; we only toggle visibility here.
        if (el.classList.contains('incid-form__map-error')) {
          el.style.display = 'none';
        } else {
          el.classList.remove('d-block');
          el.classList.add('d-none');
        }
      }
    }

    function showFieldError(id, msg) {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = msg;
        if (el.classList.contains('incid-form__map-error')) {
          el.style.display = 'block';
        } else {
          el.classList.remove('d-none');
          el.classList.add('d-block');
        }
      }
    }

    function resetAllErrors() {
      document.querySelectorAll(`[id^="${P}error-"]`).forEach((el) => {
        el.textContent = '';
        el.style.display = 'none';
      });
      const banner = document.getElementById(P + 'error');
      if (banner) {
        banner.textContent = '';
        banner.classList.add('d-none');
      }
    }

    // ── Leaflet map ──
    const mapaInicial = { lat: -0.9537, lng: -80.7286, zoom: 13 };
    const { map, remove } = await initMapView({
      container: P + 'map',
      center: { lat: mapaInicial.lat, lng: mapaInicial.lng },
      zoom: mapaInicial.zoom,
    });
    this._mapRemove = remove;
    if (!map) return;

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
      resetFieldError(P + 'error-geom');
    }

    map.on('click', (e) => setMarker(e.latlng.lat, e.latlng.lng));

    // ── Geolocation ──
    document
      .getElementById(P + 'btn-geo')
      ?.addEventListener('click', function () {
        if (!navigator.geolocation) {
          showFieldError(
            P + 'error-geom',
            'Geolocalización no disponible en este navegador.',
          );
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
              '<i class="fas fa-crosshairs me-1"></i> Usar mi ubicación actual';
          },
          () => {
            showFieldError(
              P + 'error-geom',
              'No se pudo obtener la ubicación. Verifique los permisos del navegador.',
            );
            btn.disabled = false;
            btn.innerHTML =
              '<i class="fas fa-crosshairs me-1"></i> Usar mi ubicación actual';
          },
        );
      });

    // ── Load categories (flat) ──
    try {
      const resp = await http.get('/incident-categories?per_page=500');
      categories = resp.data || resp;
      const catSelect = document.getElementById('ici-category');
      categories.forEach((cat) => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = cat.name;
        catSelect.appendChild(opt);
      });
    } catch {
      categories = [];
    }

    // ── Load locations (flat, with indentation preserved) ──
    try {
      const resp = await http.get('/locations/tree');
      locationsTree = resp.data ?? [];
    } catch {
      locationsTree = [];
    }
    const locSelect = document.getElementById('ici-location');
    function flattenTree(items, depth) {
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
    flattenTree(locationsTree, 0);
    if (locationsTree.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '-- No hay ubicaciones disponibles --';
      locSelect.appendChild(opt);
    }

    // ── Image preview ──
    const inputImagenes = $('images');
    const previsualizacion = $('image-preview');

    inputImagenes.addEventListener('change', function () {
      const files = Array.from(this.files).slice(0, 10);
      imagenesSeleccionadas = files;
      previsualizacion.innerHTML = '';

      files.forEach((file) => {
        const reader = new FileReader();
        const wrapper = document.createElement('div');
        wrapper.className = 'ici-thumb-wrapper';

        reader.onload = (e) => {
          const img = document.createElement('img');
          img.src = e.target.result;
          img.className = 'ici-thumb-img';
          wrapper.appendChild(img);
        };

        reader.readAsDataURL(file);
        previsualizacion.appendChild(wrapper);
      });
    });

    // ── Character counters ──
    const titleInput = $('title');
    const descInput = $('description');
    const titleCounter = $('char-counter-title');
    const descCounter = $('char-counter-description');

    if (titleInput && titleCounter) {
      titleInput.addEventListener('input', function () {
        titleCounter.textContent = this.value.length + '/100';
        if (this.value.trim()) {
          resetFieldError(P + 'error-title');
        }
      });
    }

    if (descInput && descCounter) {
      descInput.addEventListener('input', function () {
        descCounter.textContent = this.value.length + '/500';
      });
    }

    // ── Edit mode loading ──
    const isEdit = router.queryParams.has('id');
    const incId = router.queryParams.get('id');

    if (isEdit) {
      const pageTitleEl = document.getElementById('ici-page-title');
      const breadcrumbActiveEl = document.getElementById(
        'ici-breadcrumb-active',
      );
      const cardTitleEl = document.getElementById('ici-card-title');
      const submitBtnTextEl = document.getElementById('ici-submit-btn-text');

      if (pageTitleEl) pageTitleEl.textContent = 'Editar Incidencia';
      if (breadcrumbActiveEl) breadcrumbActiveEl.textContent = 'Editar';
      if (cardTitleEl) cardTitleEl.textContent = 'Editar Incidencia';
      if (submitBtnTextEl) submitBtnTextEl.textContent = 'Guardar Cambios';

      const toastTextEl = document.getElementById('ici-toast-text');
      if (toastTextEl)
        toastTextEl.textContent = 'Incidencia actualizada correctamente.';

      try {
        const resp = await http.get('/incidents/' + incId);
        const inc = resp.data ?? resp;

        const titleEl = $('title');
        const descEl = $('description');
        const priorityEl = $('priority');

        if (titleEl) {
          titleEl.value = inc.title ?? '';
          const titleCounter = $('char-counter-title');
          if (titleCounter)
            titleCounter.textContent = (inc.title ?? '').length + '/100';
        }
        if (descEl) {
          descEl.value = inc.description ?? '';
          const descCounter = $('char-counter-description');
          if (descCounter)
            descCounter.textContent = (inc.description ?? '').length + '/500';
        }
        if (priorityEl) {
          priorityEl.value = inc.priority ?? '';
        }

        const catSelect = document.getElementById('ici-category');
        if (catSelect) catSelect.value = inc.incident_category_id ?? '';

        const locSelect = document.getElementById('ici-location');
        if (locSelect) locSelect.value = inc.location_id ?? '';

        // Map marker
        if (inc.geom?.coordinates) {
          const [lng, lat] = inc.geom.coordinates;
          setMarker(lat, lng);
          map.setView([lat, lng], 16);
        }
      } catch (err) {
        console.error('Error al precargar la incidencia para edición:', err);
      }
    }

    // ── Submit handler ──
    const form = document.getElementById('ici-form');
    if (!form) return;

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      resetAllErrors();

      // ── Validate shared fields ──
      let valid = true;
      const title = $('title').value.trim();
      const description = $('description').value.trim();
      const priority = $('priority').value;

      if (!title) {
        showFieldError(P + 'error-title', 'El título es obligatorio');
        valid = false;
      }

      if (!geomValue) {
        showFieldError(
          P + 'error-geom',
          'Debe marcar una ubicación en el mapa',
        );
        valid = false;
      }

      const categoryId = parseInt(
        document.getElementById('ici-category').value || '',
        10,
      );
      if (!categoryId) {
        showFieldError(P + 'error-category', 'Seleccione una categoría');
        valid = false;
      }

      if (!valid) return;

      const locVal = document.getElementById('ici-location').value;
      const locationId = locVal ? parseInt(locVal, 10) : null;

      const payloadBase = {
        title,
        description: description || null,
        priority,
        incident_category_id: categoryId,
        location_id: locationId,
        geom: geomValue,
      };

      // ── Loading state ──
      const submitBtn = $('submit');
      const submitText = $('submit-text');
      const submitLoading = $('submit-loading');
      submitBtn.disabled = true;
      submitText.classList.add('d-none');
      submitLoading.classList.remove('d-none');

      // ── Send request ──
      try {
        const hasImages = imagenesSeleccionadas.length > 0;
        let body;
        if (hasImages) {
          body = new FormData();
          for (const [key, val] of Object.entries(payloadBase)) {
            if (val !== null && val !== '') {
              body.append(key, val);
            }
          }
          imagenesSeleccionadas.forEach((file) =>
            body.append('images[]', file),
          );
        } else {
          body = payloadBase;
        }

        let resp;
        if (isEdit) {
          if (hasImages) {
            body.append('_method', 'PUT');
            resp = await http.post('/incidents/' + incId, body);
          } else {
            resp = await http.put('/incidents/' + incId, body);
          }
        } else {
          resp = await http.post('/incidents', body);
        }
        const newId = resp.data?.id ?? resp.id;

        // Toast success
        const toastEl = document.getElementById('ici-toast');
        if (toastEl) {
          new bootstrap.Toast(toastEl, { delay: 2000 }).show();
        }

        setTimeout(() => {
          window.location.hash = newId
            ? `#/incidencias/${newId}`
            : '#/incidencias';
        }, 2000);
      } catch (err) {
        // 422 — validation errors
        if (err.status === 422 && err.errors) {
          for (const [field, messages] of Object.entries(err.errors)) {
            const errorSuffix = ERROR_MAP[field];
            if (errorSuffix) {
              const errorEl = document.getElementById(P + errorSuffix);
              if (errorEl) {
                errorEl.textContent = Array.isArray(messages)
                  ? messages.join(', ')
                  : messages;
                errorEl.style.display = 'block';
              }
            }
          }
          // Show general error banner
          const errorBanner = document.getElementById(P + 'error');
          if (errorBanner && err.message) {
            errorBanner.textContent = err.message;
            errorBanner.classList.remove('d-none');
          }
        } else if (err.status === 401) {
          window.location.hash = '#/login';
        } else {
          console.error('Error al crear incidencia:', err);
          const errorBanner = document.getElementById(P + 'error');
          if (errorBanner) {
            errorBanner.textContent =
              err.message ||
              'Error al guardar la incidencia. Intente nuevamente.';
            errorBanner.classList.remove('d-none');
          }
        }
      } finally {
        submitBtn.disabled = false;
        submitText.classList.remove('d-none');
        submitLoading.classList.add('d-none');
      }
    });
  },

  onDestroy() {
    document.body.classList.remove('ici-create-view');

    // Clean up Leaflet map via the helper's returned disposer
    this._mapRemove?.();
    this._mapRemove = null;
  },
};
