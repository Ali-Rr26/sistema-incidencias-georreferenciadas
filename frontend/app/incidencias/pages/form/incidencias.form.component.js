/**
 * Unified Create Incident Component
 *
 * Single component that adapts to admin (shell) and citizen (feed) contexts.
 * detectContext() evaluates #main-wrapper visibility to determine the context.
 *
 * Admin fields:  tipo→subtipo cascade, país→prov→ciudad cascade, phone, address
 * Citizen fields: flat category, flat location (indented tree)
 *
 * Shared: title, priority, description, images, map, submit
 */

import { defineComponent } from '../../../utils/component.js';
import { http } from '../../../core/http.service.js';
import loadLeaflet from '../../../shared/leaflet.js';

// ── Error field mapping: backend field → error ID suffix ──
const ERROR_MAP = {
  title: 'error-title',
  description: 'error-description',
  priority: 'error-priority',
  incident_category_id: 'error-category',
  geom: 'error-geom',
  location_id: 'error-location',
  phone: 'error-phone',
  address: 'error-address',
};

function detectContext() {
  const wrapper = document.getElementById('main-wrapper');
  const isAdmin = wrapper && wrapper.style.display !== 'none';

  const adminContainer = document.getElementById('ici-admin-container');
  const citizenContainer = document.getElementById('ici-citizen-container');
  if (adminContainer) adminContainer.classList.toggle('d-none', !isAdmin);
  if (citizenContainer) citizenContainer.classList.toggle('d-none', isAdmin);

  return isAdmin ? 'admin' : 'citizen';
}

export default defineComponent({
  templateUrl: 'app/incidencias/pages/form/incidencias.form.component.html',
  styleUrl: 'app/incidencias/pages/form/incidencias.form.component.css',

  async onInit() {
    // ── Detect context ──
    const context = detectContext();
    document.body.classList.add('ici-create-view');

    const P = context === 'admin' ? 'ici-' : 'ici-citizen-';
    const $ = (suffix) => document.getElementById(P + suffix);

    // ── State ──
    let map = null;
    let marker = null;
    let geomValue = null; // GeoJSON Point
    let imagenesSeleccionadas = [];
    let categoriasTree = [];
    let locationsTree = [];

    // ── Helpers ──

    function resetFieldError(id) {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = '';
        el.style.display = 'none';
      }
    }

    function showFieldError(id, msg) {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = msg;
        el.style.display = 'block';
      }
    }

    function resetAllErrors(contextType) {
      const prefix = contextType === 'admin' ? 'ici-' : 'ici-citizen-';
      document.querySelectorAll(`[id^="${prefix}error"]`).forEach((el) => {
        el.textContent = '';
        el.style.display = 'none';
      });
      const banner = document.getElementById(prefix + 'error');
      if (banner) {
        banner.textContent = '';
        banner.classList.add('d-none');
      }
    }

    // ── Leaflet map ──
    await loadLeaflet();

    const mapId = context === 'admin' ? 'ici-map' : 'ici-citizen-map';
    const mapContainer = document.getElementById(mapId);
    if (!mapContainer) return;

    const mapaInicial = { lat: -0.9537, lng: -80.7286, zoom: 13 };
    const mapHeight = context === 'admin' ? 360 : 280;
    mapContainer.style.height = mapHeight + 'px';

    map = L.map(mapId).setView(
      [mapaInicial.lat, mapaInicial.lng],
      mapaInicial.zoom,
    );
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

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
    setTimeout(() => map.invalidateSize(), 100);

    // ── Geolocation ──
    const geoBtnId =
      context === 'admin' ? 'ici-btn-geo' : 'ici-citizen-btn-geo';
    document.getElementById(geoBtnId)?.addEventListener('click', function () {
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
            '<i class="fas fa-location-arrow me-1"></i> Usar mi ubicación actual';
        },
        () => {
          showFieldError(
            P + 'error-geom',
            'No se pudo obtener la ubicación. Verifique los permisos del navegador.',
          );
          btn.disabled = false;
          btn.innerHTML =
            '<i class="fas fa-location-arrow me-1"></i> Usar mi ubicación actual';
        },
      );
    });

    // ── Load categories ──
    if (context === 'admin') {
      // Admin: cascada tipo → subtipo
      categoriasTree = [];
      try {
        const resp = await http.get('/incident-categories/tree');
        categoriasTree = resp.data ?? [];
      } catch {
        categoriasTree = [];
      }

      const tipoEl = document.getElementById('ici-tipo');
      categoriasTree.forEach((cat) => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = cat.name;
        tipoEl.appendChild(opt);
      });

      function poblarSelect(selectEl, hijos, placeholder) {
        selectEl.innerHTML = `<option value="">${placeholder}</option>`;
        hijos.forEach((hijo) => {
          const opt = document.createElement('option');
          opt.value = hijo.id;
          opt.textContent = hijo.name;
          selectEl.appendChild(opt);
        });
        selectEl.disabled = false;
      }

      function resetSelect(selectEl, placeholder) {
        selectEl.innerHTML = `<option value="">${placeholder}</option>`;
        selectEl.disabled = true;
        selectEl.classList.remove('is-valid', 'is-invalid');
      }

      document
        .getElementById('ici-tipo')
        .addEventListener('change', function () {
          const subtipoEl = document.getElementById('ici-subtipo');
          const padre = categoriasTree.find((c) => c.id == this.value);
          if (this.value && padre?.children?.length) {
            poblarSelect(
              subtipoEl,
              padre.children,
              '-- Seleccione subcategoría --',
            );
          } else {
            resetSelect(subtipoEl, '-- Seleccione categoría primero --');
          }
        });
    } else {
      // Citizen: categoría plana
      try {
        const resp = await http.get('/incident-categories?per_page=500');
        const categories = resp.data || resp;
        const catSelect = document.getElementById('ici-citizen-category');
        categories.forEach((cat) => {
          const opt = document.createElement('option');
          opt.value = cat.id;
          opt.textContent = cat.name;
          catSelect.appendChild(opt);
        });
      } catch {
        // No categories — form shows empty select
      }
    }

    // ── Load locations ──
    locationsTree = [];
    try {
      const resp = await http.get('/locations/tree');
      locationsTree = resp.data ?? [];
    } catch {
      locationsTree = [];
    }

    if (context === 'admin') {
      // Admin: cascada país → provincia → ciudad
      const paisEl = document.getElementById('ici-pais');
      locationsTree.forEach((pais) => {
        const opt = document.createElement('option');
        opt.value = pais.id;
        opt.textContent = pais.name;
        paisEl.appendChild(opt);
      });

      function poblarUbicaciones(selectEl, hijos, placeholder) {
        selectEl.innerHTML = `<option value="">${placeholder}</option>`;
        hijos.forEach((h) => {
          const opt = document.createElement('option');
          opt.value = h.id;
          opt.textContent = h.name;
          selectEl.appendChild(opt);
        });
        selectEl.disabled = false;
      }

      function resetUbicacion(selectEl, placeholder) {
        selectEl.innerHTML = `<option value="">${placeholder}</option>`;
        selectEl.disabled = true;
      }

      document
        .getElementById('ici-pais')
        .addEventListener('change', function () {
          const provEl = document.getElementById('ici-provincia');
          const ciudadEl = document.getElementById('ici-ciudad');
          resetUbicacion(ciudadEl, '-- Seleccione Ciudad --');
          const pais = locationsTree.find((p) => p.id == this.value);
          if (this.value && pais?.children?.length) {
            poblarUbicaciones(
              provEl,
              pais.children,
              '-- Seleccione Provincia --',
            );
          } else {
            resetUbicacion(provEl, '-- Seleccione Provincia --');
          }
        });

      document
        .getElementById('ici-provincia')
        .addEventListener('change', function () {
          const ciudadEl = document.getElementById('ici-ciudad');
          const pais = locationsTree.find((p) =>
            p.children?.some((pr) => pr.id == this.value),
          );
          const provincia = pais?.children?.find((pr) => pr.id == this.value);
          if (this.value && provincia?.children?.length) {
            poblarUbicaciones(
              ciudadEl,
              provincia.children,
              '-- Seleccione Ciudad --',
            );
          } else {
            resetUbicacion(ciudadEl, '-- Seleccione Ciudad --');
          }
        });
    } else {
      // Citizen: árbol plano con indentación
      const locSelect = document.getElementById('ici-citizen-location');
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

    // ── Phone filter (admin only) ──
    if (context === 'admin') {
      let phoneAvisoTimer = null;
      const phoneEl = document.getElementById('ici-phone');

      if (phoneEl) {
        phoneEl.addEventListener('keydown', function (e) {
          const permitidas = [
            'Backspace',
            'Delete',
            'Tab',
            'ArrowLeft',
            'ArrowRight',
            'Home',
            'End',
          ];
          if (
            !permitidas.includes(e.key) &&
            !/^[0-9]$/.test(e.key) &&
            !e.ctrlKey &&
            !e.metaKey
          ) {
            e.preventDefault();
            const aviso = document.getElementById('ici-phone-aviso');
            if (aviso) {
              aviso.classList.remove('d-none');
              clearTimeout(phoneAvisoTimer);
              phoneAvisoTimer = setTimeout(
                () => aviso.classList.add('d-none'),
                2000,
              );
            }
          }
        });

        phoneEl.addEventListener('input', function () {
          this.value = this.value.replace(/\D/g, '').slice(0, 15);
        });
      }
    }

    // ── Edit mode loading ──
    const isEdit = router.queryParams.has('id');
    const incId = router.queryParams.get('id');

    if (isEdit) {
      if (context === 'admin') {
        const pageTitleEl = document.getElementById('ici-page-title');
        const breadcrumbActiveEl = document.getElementById('ici-breadcrumb-active');
        const cardTitleEl = document.getElementById('ici-card-title');
        const submitBtnTextEl = document.getElementById('ici-submit-btn-text');

        if (pageTitleEl) pageTitleEl.textContent = 'Editar Incidencia';
        if (breadcrumbActiveEl) breadcrumbActiveEl.textContent = 'Editar';
        if (cardTitleEl) cardTitleEl.textContent = 'Editar Incidencia';
        if (submitBtnTextEl) submitBtnTextEl.textContent = 'Guardar Cambios';

        const toastTextEl = document.getElementById('ici-toast-text');
        if (toastTextEl) toastTextEl.textContent = 'Incidencia actualizada correctamente.';
      }

      try {
        const resp = await http.get('/incidents/' + incId);
        const inc = resp.data ?? resp;

        const titleEl = $('title');
        const descEl = $('description');
        const priorityEl = $('priority');

        if (titleEl) {
          titleEl.value = inc.title ?? '';
          const titleCounter = $('char-counter-title');
          if (titleCounter) titleCounter.textContent = (inc.title ?? '').length + '/100';
        }
        if (descEl) {
          descEl.value = inc.description ?? '';
          const descCounter = $('char-counter-description');
          if (descCounter) descCounter.textContent = (inc.description ?? '').length + '/500';
        }
        if (priorityEl) {
          priorityEl.value = inc.priority ?? '';
        }

        if (context === 'admin') {
          const phoneEl = document.getElementById('ici-phone');
          const addressEl = document.getElementById('ici-address');
          if (phoneEl) phoneEl.value = inc.phone ?? '';
          if (addressEl) addressEl.value = inc.address ?? '';

          // Category cascade
          if (inc.incident_category_id) {
            let parentId = null;
            let childId = null;
            for (const cat of categoriasTree) {
              if (cat.id == inc.incident_category_id) {
                parentId = cat.id;
                break;
              }
              if (cat.children) {
                for (const child of cat.children) {
                  if (child.id == inc.incident_category_id) {
                    parentId = cat.id;
                    childId = child.id;
                    break;
                  }
                }
              }
              if (parentId) break;
            }

            if (parentId) {
              const tipoEl = document.getElementById('ici-tipo');
              if (tipoEl) {
                tipoEl.value = parentId;
                if (childId) {
                  const padre = categoriasTree.find((c) => c.id == parentId);
                  const subtipoEl = document.getElementById('ici-subtipo');
                  if (padre && padre.children && subtipoEl) {
                    poblarSelect(subtipoEl, padre.children, '-- Seleccione subcategoría --');
                    subtipoEl.value = childId;
                  }
                }
              }
            }
          }

          // Location cascade
          if (inc.location_id) {
            let cityId = null;
            let provId = null;
            let countryId = null;

            for (const country of locationsTree) {
              if (country.id == inc.location_id) {
                countryId = country.id;
                break;
              }
              if (country.children) {
                for (const prov of country.children) {
                  if (prov.id == inc.location_id) {
                    countryId = country.id;
                    provId = prov.id;
                    break;
                  }
                  if (prov.children) {
                    for (const city of prov.children) {
                      if (city.id == inc.location_id) {
                        countryId = country.id;
                        provId = prov.id;
                        cityId = city.id;
                        break;
                      }
                    }
                  }
                  if (cityId) break;
                }
              }
              if (countryId && !provId && !cityId) break;
              if (provId) break;
            }

            if (countryId) {
              const paisEl = document.getElementById('ici-pais');
              if (paisEl) {
                paisEl.value = countryId;
                const countryObj = locationsTree.find((p) => p.id == countryId);
                const provEl = document.getElementById('ici-provincia');
                if (countryObj && countryObj.children && provEl) {
                  poblarUbicaciones(provEl, countryObj.children, '-- Seleccione Provincia --');
                  if (provId) {
                    provEl.value = provId;
                    const provObj = countryObj.children.find((p) => p.id == provId);
                    const ciudadEl = document.getElementById('ici-ciudad');
                    if (provObj && provObj.children && ciudadEl) {
                      poblarUbicaciones(ciudadEl, provObj.children, '-- Seleccione Ciudad --');
                      if (cityId) {
                        ciudadEl.value = cityId;
                      }
                    }
                  }
                }
              }
            }
          }
        } else {
          const catSelect = document.getElementById('ici-citizen-category');
          if (catSelect) catSelect.value = inc.incident_category_id ?? '';

          const locSelect = document.getElementById('ici-citizen-location');
          if (locSelect) locSelect.value = inc.location_id ?? '';
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
    const formId = context === 'admin' ? 'ici-form' : 'ici-citizen-form';
    const form = document.getElementById(formId);
    if (!form) return;

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      resetAllErrors(context);

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

      let categoryId;
      if (context === 'admin') {
        const subtipoEl = document.getElementById('ici-subtipo');
        const tipoEl = document.getElementById('ici-tipo');
        categoryId = parseInt(
          (subtipoEl.value && !subtipoEl.disabled
            ? subtipoEl.value
            : tipoEl.value) || '',
          10,
        );
        if (!categoryId) {
          showFieldError(P + 'error-category', 'Seleccione una categoría');
          valid = false;
        }

        // Admin: validate cascade location
        const ciudadVal = document.getElementById('ici-ciudad').value;
        const provinciaVal = document.getElementById('ici-provincia').value;
        const paisVal = document.getElementById('ici-pais').value;
        if (!ciudadVal && !provinciaVal && !paisVal) {
          showFieldError(
            P + 'error-location',
            'Seleccione un país, provincia o ciudad',
          );
          valid = false;
        }

        // Admin: phone min 7 digits if entered
        const phoneEl = document.getElementById('ici-phone');
        if (phoneEl.value !== '' && phoneEl.value.length < 7) {
          showFieldError(
            P + 'error-phone',
            'El teléfono debe tener al menos 7 dígitos',
          );
          valid = false;
        }
      } else {
        categoryId = parseInt(
          document.getElementById('ici-citizen-category').value || '',
          10,
        );
        if (!categoryId) {
          showFieldError(P + 'error-category', 'Seleccione una categoría');
          valid = false;
        }
      }

      if (!valid) return;

      // ── Build payload ──
      let locationId = null;
      if (context === 'admin') {
        locationId = parseInt(
          document.getElementById('ici-ciudad').value ||
            document.getElementById('ici-provincia').value ||
            document.getElementById('ici-pais').value ||
            '',
          10,
        );
        if (!locationId) locationId = null;
      } else {
        const locVal = document.getElementById('ici-citizen-location').value;
        locationId = locVal ? parseInt(locVal, 10) : null;
      }

      const payloadBase = {
        title,
        description: description || null,
        priority,
        incident_category_id: categoryId,
        location_id: locationId,
        geom: geomValue,
      };

      // Admin-only fields
      if (context === 'admin') {
        const phone = document.getElementById('ici-phone').value;
        const address = document.getElementById('ici-address').value.trim();
        if (phone) payloadBase.phone = phone;
        if (address) payloadBase.address = address;
      }

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
          if (context === 'admin') {
            window.location.hash = newId
              ? `#/incidencias/${newId}`
              : '#/incidencias';
          } else {
            window.location.hash = '#/feed';
          }
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
    // Remove body class
    document.body.classList.remove('ici-create-view');

    // Clean up Leaflet map
    const mapIds = ['ici-map', 'ici-citizen-map'];
    mapIds.forEach((id) => {
      const mapEl = document.getElementById(id);
      if (mapEl && mapEl._leaflet_id) {
        const map = window.L?.DomUtil?.get(mapEl);
        if (map) map.remove();
      }
    });
  },
});
