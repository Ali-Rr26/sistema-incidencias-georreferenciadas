/**
 * Unified Create/Edit Incident Form — 4-step stepper
 *
 * Steps: 1 Información Básica → 2 Categorización y Archivos →
 * 3 Ubicación → 4 Revisión. Single template, one <form>, panels toggled
 * via `d-none`; no shell-based context detection; all elements use the
 * `ici-` prefix.
 */

import template from './incidencias.form.component.html?raw';
import style from './incidencias.form.component.css?raw';
import uploaderStyle from '../../../shared/image-uploader.css?raw';
import { http } from '../../../core/http.service.js';
import { router } from '../../../core/router.js';
import initMapView from '../../../shared/init-map-view.js';
import { mountImageUploader } from '../../../shared/image-uploader.js';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point as turfPoint } from '@turf/helpers';

// ── Error field mapping: backend field → error ID suffix ──
const ERROR_MAP = {
  title: 'error-title',
  description: 'error-description',
  priority: 'error-priority',
  incident_category_id: 'error-category',
  geom: 'error-geom',
  location_id: 'error-location',
};

// ── Which step each backend-validated field lives on, so a 422 jumps
// the user back to where the offending field actually is ──
const FIELD_STEP = {
  title: 1,
  description: 1,
  priority: 1,
  incident_category_id: 2,
  location_id: 2,
  geom: 3,
};

const P = 'ici-';
const $ = (suffix) => document.getElementById(P + suffix);

const TOTAL_STEPS = 4;
const PRIORITY_LABELS = { high: 'Alta', medium: 'Media', low: 'Baja' };

export default {
  template,
  style: style + '\n' + uploaderStyle,

  async onInit() {
    document.body.classList.add('ici-create-view');

    // ── State ──
    let marker = null;
    let geomValue = null; // GeoJSON Point
    let imagenesSeleccionadas = [];
    let categoryTree = [];
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

    // ── Character counters — declared before any await below so the
    // step-machine bootstrap (next) can safely call validateStep1() the
    // moment a user clicks Siguiente, even mid-fetch ──
    const titleInput = $('title');
    const descInput = $('description');
    const priorityInput = $('priority');
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

    if (priorityInput) {
      priorityInput.addEventListener('change', function () {
        if (this.value) resetFieldError(P + 'error-priority');
      });
    }

    // ── Step machine bootstrap — runs synchronously, before the Leaflet
    // map / categories / locations awaits below, so the footer never
    // flashes all four buttons at once and Siguiente/Anterior aren't
    // dead buttons while those requests are in flight ──
    let currentStep = 1;
    goToStep(1);

    $('btn-next')?.addEventListener('click', () => {
      if (currentStep === 1 && !validateStep1()) return;
      if (currentStep === 2 && !validateStep2()) return;
      if (currentStep === 3 && !validateStep3()) return;
      goToStep(currentStep + 1);
    });

    $('btn-prev')?.addEventListener('click', () => {
      goToStep(currentStep - 1);
    });

    [1, 2, 3].forEach((n) => {
      document
        .getElementById(P + 'review-edit-' + n)
        ?.addEventListener('click', (e) => {
          e.preventDefault();
          goToStep(n);
        });
    });

    // ── Boundary overlay state (feature: map-location-boundary) ──
    //
    // El endpoint `GET /api/locations/{id}` ya incluye `geom` en su respuesta
    // (ver `LocationResource::resolve()`), y el árbol `locationsTree` que se
    // carga arriba ya trae cada nodo con su `geom`. No hace falta un endpoint
    // nuevo: leemos directo del árbol en memoria. Estos helpers resuelven el
    // boundary para la location seleccionada.
    let pendingBoundary = null; // GeoJSON (MultiPolygon / Polygon) a dibujar
    let pendingBoundaryLabel = null; // "cantón Santa Elena" (para el mensaje)
    let pendingBoundarySublabel = null; // "Parroquia X dentro de cantón Y"
    let boundaryLayer = null; // referencia Leaflet del layer actual

    function findLocationInTree(id, nodes) {
      if (!id || !nodes) return null;
      const target = String(id);
      // Acepta tanto el array raíz (`locationsTree`) como un nodo individual.
      const list = Array.isArray(nodes) ? nodes : [nodes];
      for (const node of list) {
        if (!node || node.id == null) continue;
        if (String(node.id) === target) return node;
        if (Array.isArray(node.children)) {
          const hit = findLocationInTree(id, node.children);
          if (hit) return hit;
        }
      }
      return null;
    }

    function resolveBoundaryFromSelection(location) {
      if (!location) return null;
      if (location.geom) {
        return {
          geom: location.geom,
          level: location.level,
          name: location.name,
          source: 'self',
        };
      }
      // Parish sin geom: subimos al cantón padre que sí tiene boundary.
      if (location.parent_id) {
        const parent = findLocationInTree(location.parent_id, locationsTree);
        if (parent && parent.geom) {
          return {
            geom: parent.geom,
            level: parent.level,
            name: parent.name,
            source: 'parent',
            parishName: location.name,
          };
        }
      }
      return null;
    }

    function applyBoundaryFromSelection(location) {
      pendingBoundary = null;
      pendingBoundaryLabel = null;
      pendingBoundarySublabel = null;
      const r = resolveBoundaryFromSelection(location);
      if (!r) {
        renderBoundaryUI();
        return;
      }
      pendingBoundary = r.geom;
      // "cantón" para city, "provincia" para province — singular para el mensaje.
      const levelTxt =
        r.level === 'city'
          ? 'cantón'
          : r.level === 'province'
            ? 'provincia'
            : r.level;
      pendingBoundaryLabel = `${levelTxt} ${r.name}`;
      pendingBoundarySublabel =
        r.source === 'parent' && r.parishName
          ? `Parroquia ${r.parishName} dentro de ${levelTxt} ${r.name}`
          : null;
      // Si el map ya está montado, dibujamos ahora; si no, `pendingBoundary`
      // queda seteada para que el primer render del map (más abajo) lo agarre.
      if (map) drawBoundaryLayer();
      renderBoundaryUI();
    }

    function drawBoundaryLayer() {
      if (!map) return;
      if (boundaryLayer) {
        boundaryLayer.remove();
        boundaryLayer = null;
      }
      if (!pendingBoundary) return;
      boundaryLayer = L.geoJSON(pendingBoundary, {
        style: {
          color: '#3b82f6',
          weight: 2,
          fillColor: '#3b82f6',
          fillOpacity: 0.15,
        },
      }).addTo(map);
      try {
        map.fitBounds(boundaryLayer.getBounds(), {
          padding: [20, 20],
          maxZoom: 14,
        });
      } catch {
        /* getBounds puede fallar si la geometría está vacía; ignorar */
      }
    }

    function renderBoundaryUI() {
      const sublabelEl = document.getElementById(P + 'boundary-sublabel');
      const disclaimerEl = document.getElementById(P + 'boundary-disclaimer');
      if (sublabelEl) {
        if (pendingBoundarySublabel) {
          sublabelEl.textContent = pendingBoundarySublabel;
          sublabelEl.classList.remove('d-none');
        } else {
          sublabelEl.classList.add('d-none');
        }
      }
      if (disclaimerEl) {
        disclaimerEl.classList.toggle('d-none', !pendingBoundary);
      }
      // El warning se refresca separadamente porque depende del pin,
      // no solo de la selección.
      refreshPinVsBoundary();
    }

    function setPinVariant(variant) {
      // 'default' | 'ok' | 'warn'
      if (!marker) return;
      const dom = marker.getElement();
      if (!dom) return;
      // Leaflet envuelve el icono en un `.leaflet-marker-icon`; aplicamos
      // la clase sobre ese, o sobre el contenedor si no se encuentra.
      const target = dom.querySelector?.('.leaflet-marker-icon') || dom;
      target.classList.remove(
        'incid-form__marker--ok',
        'incid-form__marker--warn',
      );
      if (variant === 'ok') target.classList.add('incid-form__marker--ok');
      if (variant === 'warn') target.classList.add('incid-form__marker--warn');
    }

    function refreshPinVsBoundary() {
      const warningEl = document.getElementById(P + 'boundary-warning');
      if (!marker || !pendingBoundary) {
        setPinVariant('default');
        if (warningEl) {
          warningEl.classList.add('d-none');
          warningEl.textContent = '';
        }
        return;
      }
      const ll = marker.getLatLng();
      const inside = booleanPointInPolygon(
        turfPoint([ll.lng, ll.lat]),
        pendingBoundary,
      );
      if (inside) {
        setPinVariant('ok');
        if (warningEl) {
          warningEl.classList.add('d-none');
          warningEl.textContent = '';
        }
      } else {
        setPinVariant('warn');
        if (warningEl) {
          warningEl.textContent = `El pin está fuera de la ubicación ${pendingBoundaryLabel}. Si querés enviar igual, podés hacerlo.`;
          warningEl.classList.remove('d-none');
        }
      }
    }

    // ── Leaflet map ──
    const mapaInicial = { lat: -0.9537, lng: -80.7286, zoom: 13 };
    const { map, remove } = await initMapView({
      container: P + 'map',
      center: { lat: mapaInicial.lat, lng: mapaInicial.lng },
      zoom: mapaInicial.zoom,
    });
    // Wrap the disposer para limpiar también el boundary layer (feature: map-location-boundary).
    this._mapRemove = () => {
      if (boundaryLayer) {
        boundaryLayer.remove();
        boundaryLayer = null;
      }
      remove();
    };
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
      // Feature: map-location-boundary — refrescar estado del pin vs el
      // boundary actualmente dibujado (color + warning inline).
      refreshPinVsBoundary();
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

    // ── Load categories (parent → child tree) ──
    const catSelect = document.getElementById('ici-category');
    const subcatSelect = document.getElementById('ici-subcategory');

    function findCategoryNode(nodes, id) {
      for (const node of nodes) {
        if (String(node.id) === String(id)) return { node, isRoot: true };
        const children = node.children || [];
        const child = children.find((c) => String(c.id) === String(id));
        if (child) return { node: child, parent: node, isRoot: false };
      }
      return null;
    }

    function populateSubcategories(parentId) {
      subcatSelect.innerHTML = '';
      const parent = categoryTree.find(
        (c) => String(c.id) === String(parentId),
      );
      const children = parent?.children ?? [];

      if (!parent || children.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = parent
          ? '-- Sin subcategorías --'
          : '-- Seleccione una categoría primero --';
        subcatSelect.appendChild(opt);
        subcatSelect.disabled = true;
        return;
      }

      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = '-- Seleccione subcategoría (opcional) --';
      subcatSelect.appendChild(placeholder);

      children.forEach((child) => {
        const opt = document.createElement('option');
        opt.value = child.id;
        opt.textContent = child.name;
        subcatSelect.appendChild(opt);
      });
      subcatSelect.disabled = false;
    }

    // ── Load categories and locations in parallel ──
    try {
      const [catResp, locResp] = await Promise.all([
        http.get('/incident-categories/tree'),
        http.get('/locations/tree'),
      ]);

      categoryTree = catResp.data ?? catResp ?? [];
      categoryTree.forEach((cat) => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = cat.name;
        catSelect.appendChild(opt);
      });

      locationsTree = locResp.data ?? [];
    } catch {
      categoryTree = [];
      locationsTree = [];
    }

    catSelect.addEventListener('change', function () {
      populateSubcategories(this.value);
      resetFieldError(P + 'error-category');
    });

    // ── Location cascade: Provincia → Cantón → Parroquia ──
    // Mirrors the category/subcategory cascade above. `locationsTree` is
    // rooted at the single country node (Ecuador) — its direct children
    // are provinces, so the country level itself is never shown (there's
    // nothing to choose, it's the only option). Parroquia stays optional,
    // same as subcategory: the submitted location_id is the deepest level
    // actually chosen (neighborhood if picked, else city, else null).
    const provinceSelect = document.getElementById('ici-location-province');
    const citySelect = document.getElementById('ici-location-city');
    const neighborhoodSelect = document.getElementById(
      'ici-location-neighborhood',
    );
    const provinces = locationsTree[0]?.children ?? [];

    function populateCities(provinceId) {
      citySelect.innerHTML = '';
      neighborhoodSelect.innerHTML = '';
      const province = provinces.find(
        (p) => String(p.id) === String(provinceId),
      );
      const cities = province?.children ?? [];

      if (!province || cities.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = province
          ? '-- Sin cantones --'
          : '-- Seleccione una provincia primero --';
        citySelect.appendChild(opt);
        citySelect.disabled = true;
      } else {
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = '-- Seleccione cantón --';
        citySelect.appendChild(placeholder);
        cities.forEach((city) => {
          const opt = document.createElement('option');
          opt.value = city.id;
          opt.textContent = city.name;
          citySelect.appendChild(opt);
        });
        citySelect.disabled = false;
      }

      const emptyOpt = document.createElement('option');
      emptyOpt.value = '';
      emptyOpt.textContent = '-- Seleccione un cantón primero --';
      neighborhoodSelect.appendChild(emptyOpt);
      neighborhoodSelect.disabled = true;
    }

    function populateNeighborhoods(cityId) {
      neighborhoodSelect.innerHTML = '';
      const province = provinces.find(
        (p) => String(p.id) === String(provinceSelect.value),
      );
      const city = province?.children?.find(
        (c) => String(c.id) === String(cityId),
      );
      const neighborhoods = city?.children ?? [];

      if (!city || neighborhoods.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = city
          ? '-- Sin parroquias --'
          : '-- Seleccione un cantón primero --';
        neighborhoodSelect.appendChild(opt);
        neighborhoodSelect.disabled = true;
        return;
      }

      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = '-- Seleccione parroquia (opcional) --';
      neighborhoodSelect.appendChild(placeholder);
      neighborhoods.forEach((n) => {
        const opt = document.createElement('option');
        opt.value = n.id;
        opt.textContent = n.name;
        neighborhoodSelect.appendChild(opt);
      });
      neighborhoodSelect.disabled = false;
    }

    // The "-- Sin ubicación fija --" placeholder is already the first
    // <option> in the static markup (matches the category select's
    // convention — the parent select's own placeholder lives in the
    // HTML, not re-created here) so it reads fine even with zero
    // provinces; just append the real options after it.
    provinces.forEach((province) => {
      const opt = document.createElement('option');
      opt.value = province.id;
      opt.textContent = province.name;
      provinceSelect.appendChild(opt);
    });

    provinceSelect.addEventListener('change', function () {
      populateCities(this.value);
      // Feature: map-location-boundary — actualiza el boundary overlay.
      const loc = findLocationInTree(this.value, locationsTree);
      applyBoundaryFromSelection(loc);
    });
    citySelect.addEventListener('change', function () {
      populateNeighborhoods(this.value);
      const loc = findLocationInTree(this.value, locationsTree);
      applyBoundaryFromSelection(loc);
    });
    neighborhoodSelect.addEventListener('change', function () {
      // Para parroquia: si tiene geom propio, úsalo; si no, el
      // `resolveBoundaryFromSelection` resuelve al cantón padre.
      const loc = findLocationInTree(this.value, locationsTree);
      applyBoundaryFromSelection(loc);
    });

    /**
     * Walk the location tree to find which province/city/neighborhood a
     * given location_id belongs to, so edit mode can preselect all three
     * cascading selects at once (mirrors findCategoryNode above, one
     * level deeper since locations nest country → province → city →
     * neighborhood instead of category → subcategory).
     */
    function findLocationAncestry(id) {
      for (const province of provinces) {
        if (String(province.id) === String(id)) {
          return { province };
        }
        for (const city of province.children ?? []) {
          if (String(city.id) === String(id)) {
            return { province, city };
          }
          for (const neighborhood of city.children ?? []) {
            if (String(neighborhood.id) === String(id)) {
              return { province, city, neighborhood };
            }
          }
        }
      }
      return null;
    }

    // ── Image Uploader ──
    let imageUploaderController = null;
    const uploaderContainer = $('image-uploader-container');
    if (uploaderContainer) {
      imageUploaderController = mountImageUploader({
        container: uploaderContainer,
        inputId: 'ici-images',
        maxFiles: 10,
        maxSizeMB: 5,
        onChange: (files) => {
          imagenesSeleccionadas = files;
        },
      });
    }

    // ── Step machine (1 Info Básica → 2 Categorización y Archivos →
    // 3 Ubicación → 4 Revisión) — `currentStep` and the Siguiente/
    // Anterior/Editar listeners are declared earlier, before any await,
    // see the bootstrap block above. Only the function bodies live here.

    function stepPanel(n) {
      return document.getElementById(P + 'step-' + n);
    }

    function updateStepperIndicator(n) {
      for (let i = 1; i <= TOTAL_STEPS; i++) {
        const dot = document.getElementById(P + 'stepper-' + i);
        if (!dot) continue;
        dot.classList.toggle('ici-stepper__step--active', i === n);
        dot.classList.toggle('ici-stepper__step--done', i < n);
      }
    }

    function updateFooterButtons(n) {
      $('btn-cancel')?.classList.toggle('d-none', n !== 1);
      $('btn-prev')?.classList.toggle('d-none', n === 1);
      $('btn-next')?.classList.toggle('d-none', n === TOTAL_STEPS);
      $('submit')?.classList.toggle('d-none', n !== TOTAL_STEPS);
    }

    function selectedOptionText(selectEl) {
      const opt = selectEl?.selectedOptions?.[0];
      return opt && opt.value ? opt.textContent : '';
    }

    function renderReviewSummary() {
      const reviewTitle = $('review-title');
      if (reviewTitle) reviewTitle.textContent = titleInput?.value || '—';

      const reviewPriority = $('review-priority');
      if (reviewPriority) {
        reviewPriority.textContent =
          PRIORITY_LABELS[priorityInput?.value] || '—';
      }

      const reviewDescription = $('review-description');
      if (reviewDescription) {
        reviewDescription.textContent = descInput?.value || 'Sin descripción';
      }

      const reviewCategory = $('review-category');
      if (reviewCategory) {
        const subcatText = selectedOptionText(subcatSelect);
        const catText = selectedOptionText(catSelect);
        reviewCategory.textContent = subcatText || catText || '—';
      }

      const reviewLocation = $('review-location');
      if (reviewLocation) {
        // Mirrors the submit handler's precedence exactly (neighborhood ||
        // city, no province-alone fallback) — a province-only selection
        // submits location_id: null, so it must never be displayed here
        // as if it were going to be saved.
        const cityVal = citySelect?.value;
        const neighborhoodVal = neighborhoodSelect?.value;
        if (cityVal || neighborhoodVal) {
          const parts = [
            selectedOptionText(provinceSelect),
            selectedOptionText(citySelect),
            selectedOptionText(neighborhoodSelect),
          ].filter(Boolean);
          reviewLocation.textContent = parts.join(', ');
        } else {
          reviewLocation.textContent = 'Sin ubicación fija';
        }
      }

      const reviewImagesCount = $('review-images-count');
      if (reviewImagesCount) {
        reviewImagesCount.textContent = imagenesSeleccionadas.length
          ? `${imagenesSeleccionadas.length} imagen(es) adjunta(s)`
          : 'Sin imágenes adjuntas';
      }

      const reviewCoords = $('review-coords');
      if (reviewCoords) {
        if (geomValue?.coordinates) {
          const [lng, lat] = geomValue.coordinates;
          reviewCoords.textContent = `Lat: ${lat}, Lng: ${lng}`;
        } else {
          reviewCoords.textContent = 'Sin ubicación en el mapa';
        }
      }
    }

    function goToStep(n) {
      currentStep = Math.min(TOTAL_STEPS, Math.max(1, n));
      for (let i = 1; i <= TOTAL_STEPS; i++) {
        stepPanel(i)?.classList.toggle('d-none', i !== currentStep);
      }
      updateStepperIndicator(currentStep);
      updateFooterButtons(currentStep);
      // The map is created while step 3 is still `d-none` (it's the last
      // step reachable, initialized up front so a click can drop a
      // marker as soon as the user arrives); Leaflet can't size itself
      // correctly inside a hidden container, so force a resize the
      // moment the panel actually becomes visible.
      if (currentStep === 3) map?.invalidateSize();
      if (currentStep === TOTAL_STEPS) renderReviewSummary();
    }

    function validateStep1() {
      let valid = true;
      if (!titleInput?.value.trim()) {
        showFieldError(P + 'error-title', 'El título es obligatorio');
        valid = false;
      }
      if (!priorityInput?.value) {
        showFieldError(P + 'error-priority', 'Seleccione la prioridad');
        valid = false;
      }
      return valid;
    }

    function validateStep2() {
      const categoryId = subcatSelect?.value || catSelect?.value || '';
      if (!categoryId) {
        showFieldError(P + 'error-category', 'Seleccione una categoría');
        return false;
      }
      resetFieldError(P + 'error-category');
      return true;
    }

    function validateStep3() {
      if (!geomValue) {
        showFieldError(
          P + 'error-geom',
          'Debe marcar una ubicación en el mapa',
        );
        return false;
      }
      return true;
    }

    $('btn-next')?.addEventListener('click', () => {
      if (currentStep === 1 && !validateStep1()) return;
      if (currentStep === 2 && !validateStep2()) return;
      if (currentStep === 3 && !validateStep3()) return;
      goToStep(currentStep + 1);
    });

    $('btn-prev')?.addEventListener('click', () => {
      goToStep(currentStep - 1);
    });

    [1, 2, 3].forEach((n) => {
      document
        .getElementById(P + 'review-edit-' + n)
        ?.addEventListener('click', (e) => {
          e.preventDefault();
          goToStep(n);
        });
    });

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

        const currentCategoryId = inc.incident_category_id ?? null;
        if (currentCategoryId) {
          const match = findCategoryNode(categoryTree, currentCategoryId);
          if (match) {
            if (match.isRoot) {
              catSelect.value = String(match.node.id);
              populateSubcategories(match.node.id);
            } else {
              catSelect.value = String(match.parent.id);
              populateSubcategories(match.parent.id);
              subcatSelect.value = String(match.node.id);
            }
          }
        }

        const locationId = inc.location_id ?? null;
        if (locationId) {
          const ancestry = findLocationAncestry(locationId);
          if (ancestry) {
            provinceSelect.value = String(ancestry.province.id);
            populateCities(ancestry.province.id);
            if (ancestry.city) {
              citySelect.value = String(ancestry.city.id);
              populateNeighborhoods(ancestry.city.id);
              if (ancestry.neighborhood) {
                neighborhoodSelect.value = String(ancestry.neighborhood.id);
              }
            }
          }
        }

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

      // ── Validate shared fields (defense in depth — the per-step
      // gates above should already guarantee these hold by the time
      // step 4's submit button is reachable) ──
      let valid = true;
      let firstInvalidStep = null;
      const title = $('title').value.trim();
      const description = $('description').value.trim();
      const priority = $('priority').value;

      if (!title || !priority) {
        if (!title) {
          showFieldError(P + 'error-title', 'El título es obligatorio');
        }
        if (!priority) {
          showFieldError(P + 'error-priority', 'Seleccione la prioridad');
        }
        valid = false;
        firstInvalidStep = firstInvalidStep ?? 1;
      }

      const parentCategoryVal = document.getElementById('ici-category').value;
      const subCategoryVal = document.getElementById('ici-subcategory').value;
      // The subcategory (child), when selected, is the actual category
      // sent to the backend — it's the more specific classification.
      // Falls back to the parent category when no subcategory was chosen
      // (e.g. the parent has no children, or the citizen left it blank).
      const categoryId = parseInt(
        subCategoryVal || parentCategoryVal || '',
        10,
      );
      if (!categoryId) {
        showFieldError(P + 'error-category', 'Seleccione una categoría');
        valid = false;
        firstInvalidStep = firstInvalidStep ?? 2;
      }

      if (!geomValue) {
        showFieldError(
          P + 'error-geom',
          'Debe marcar una ubicación en el mapa',
        );
        valid = false;
        firstInvalidStep = firstInvalidStep ?? 3;
      }

      if (!valid) {
        goToStep(firstInvalidStep);
        return;
      }

      // Deepest level actually chosen wins — same fallback logic as
      // category/subcategory (neighborhoodVal || cityVal), except there's
      // no province-level fallback: a province alone isn't specific
      // enough to be a submittable location_id, so it's treated the same
      // as leaving the whole cascade blank (null).
      const neighborhoodVal = document.getElementById(
        'ici-location-neighborhood',
      ).value;
      const cityVal = document.getElementById('ici-location-city').value;
      const locVal = neighborhoodVal || cityVal;
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
        const filesToUpload = imageUploaderController
          ? imageUploaderController.getFiles()
          : imagenesSeleccionadas;
        const hasImages = filesToUpload.length > 0;
        let body;
        if (hasImages) {
          body = new FormData();
          for (const [key, val] of Object.entries(payloadBase)) {
            if (val !== null && val !== '') {
              // FormData coerces objects to "[object Object]", so serialize geom explicitly.
              body.append(key, key === 'geom' ? JSON.stringify(val) : val);
            }
          }
          filesToUpload.forEach((file) => body.append('images[]', file));
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
          router.navigate(newId ? `/incidencias/${newId}` : '/incidencias');
        }, 2000);
      } catch (err) {
        // 422 — validation errors
        if (err.status === 422 && err.errors) {
          // Land on the EARLIEST step among all returned fields, not
          // just the first one the backend happened to list — errors on
          // other steps are still written into their own (now hidden)
          // panel below, but a step order lower than that would strand
          // the user unable to see them.
          let backendErrorStep = null;
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
              const fieldStep = FIELD_STEP[field] ?? null;
              if (fieldStep !== null) {
                backendErrorStep =
                  backendErrorStep === null
                    ? fieldStep
                    : Math.min(backendErrorStep, fieldStep);
              }
            }
          }
          if (backendErrorStep) goToStep(backendErrorStep);
          // Show general error banner
          const errorBanner = document.getElementById(P + 'error');
          if (errorBanner && err.message) {
            errorBanner.textContent = err.message;
            errorBanner.classList.remove('d-none');
          }
        } else if (err.status === 401) {
          router.navigate('/login');
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

    this._imageUploader?.destroy();
    this._imageUploader = null;

    // Clean up Leaflet map via the helper's returned disposer
    this._mapRemove?.();
    this._mapRemove = null;
  },
};
