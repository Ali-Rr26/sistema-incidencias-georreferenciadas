import { defineComponent } from '../../../utils/component.js';
import { http } from '../../../core/http.service.js';

/** @type {Array<{id: number, name: string, children: Array}>} */
let categoriasTree = [];

/** @type {Array<{id: number, name: string, children: Array}>} */
let locationsTree = [];

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

export default defineComponent({
  templateUrl: 'app/incidencias/pages/form/incidencias.form.component.html',

  async onInit() {
    // Load Leaflet and init map
    await loadLeaflet();

    const mapaInicial = { lat: -0.9537, lng: -80.7286, zoom: 13 };
    const mapa = L.map('mapa-incidencia').setView(
      [mapaInicial.lat, mapaInicial.lng],
      mapaInicial.zoom,
    );
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(mapa);

    let marcador = null;

    function colocarMarcador(lat, lng) {
      if (marcador) {
        marcador.setLatLng([lat, lng]);
      } else {
        marcador = L.marker([lat, lng], { draggable: true }).addTo(mapa);
        marcador.on('dragend', () => {
          const pos = marcador.getLatLng();
          document.getElementById('latitud').value = pos.lat.toFixed(6);
          document.getElementById('longitud').value = pos.lng.toFixed(6);
        });
      }
      document.getElementById('latitud').value = lat.toFixed(6);
      document.getElementById('longitud').value = lng.toFixed(6);
      document.getElementById('error-mapa').classList.add('d-none');
    }

    mapa.on('click', (e) => colocarMarcador(e.latlng.lat, e.latlng.lng));

    // Geolocation
    document
      .getElementById('btn-geolocalizacion')
      .addEventListener('click', function () {
        if (!navigator.geolocation) {
          alert('Su navegador no soporta geolocalización.');
          return;
        }
        const btn = this;
        btn.disabled = true;
        btn.innerHTML =
          '<span class="spinner-border spinner-border-sm me-1"></span> Detectando...';

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            mapa.setView([lat, lng], 16);
            colocarMarcador(lat, lng);
            btn.disabled = false;
            btn.innerHTML =
              '<i class="fas fa-location-arrow me-1"></i> Usar mi ubicación actual';
          },
          () => {
            alert(
              'No se pudo obtener la ubicación. Verifique los permisos del navegador.',
            );
            btn.disabled = false;
            btn.innerHTML =
              '<i class="fas fa-location-arrow me-1"></i> Usar mi ubicación actual';
          },
        );
      });

    // Fetch categorías desde la API
    async function cargarCategorias() {
      try {
        const resp = await http.get('/incident-categories/tree');
        categoriasTree = resp.data ?? [];
      } catch {
        categoriasTree = [];
      }

      const tipoEl = document.getElementById('tipo');
      categoriasTree.forEach((cat) => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = cat.name;
        tipoEl.appendChild(opt);
      });
    }
    cargarCategorias();

    // Cascada Tipo → Subtipo
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

    document.getElementById('tipo').addEventListener('change', function () {
      const subtipoEl = document.getElementById('subtipo');
      const padre = categoriasTree.find(c => c.id == this.value);
      if (this.value && padre?.children?.length) {
        poblarSelect(subtipoEl, padre.children, '-- Seleccione subcategoría --');
      } else {
        resetSelect(subtipoEl, '-- Seleccione categoría primero --');
      }
    });

    // --- Ubicación jerárquica: País → Provincia → Ciudad ---
    async function cargarUbicaciones() {
      try {
        const resp = await http.get('/locations/tree');
        locationsTree = resp.data ?? [];
      } catch {
        locationsTree = [];
      }

      const paisEl = document.getElementById('pais');
      locationsTree.forEach((pais) => {
        const opt = document.createElement('option');
        opt.value = pais.id;
        opt.textContent = pais.name;
        paisEl.appendChild(opt);
      });
    }
    cargarUbicaciones();

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

    document.getElementById('pais').addEventListener('change', function () {
      const provEl = document.getElementById('provincia');
      const ciudadEl = document.getElementById('ciudad');
      resetUbicacion(ciudadEl, '-- Seleccione Ciudad --');
      const pais = locationsTree.find((p) => p.id == this.value);
      if (this.value && pais?.children?.length) {
        poblarUbicaciones(provEl, pais.children, '-- Seleccione Provincia --');
      } else {
        resetUbicacion(provEl, '-- Seleccione Provincia --');
      }
    });

    document.getElementById('provincia').addEventListener('change', function () {
      const ciudadEl = document.getElementById('ciudad');
      let pais = locationsTree.find((p) =>
        p.children?.some((pr) => pr.id == this.value),
      );
      const provincia = pais?.children?.find((pr) => pr.id == this.value);
      if (this.value && provincia?.children?.length) {
        poblarUbicaciones(ciudadEl, provincia.children, '-- Seleccione Ciudad --');
      } else {
        resetUbicacion(ciudadEl, '-- Seleccione Ciudad --');
      }
    });

    // Image preview
    const inputImagenes = document.getElementById('imagenes');
    const previsualizacion = document.getElementById('previsualizacion-imagenes');
    let imagenesSeleccionadas = [];

    inputImagenes.addEventListener('change', function () {
      const files = Array.from(this.files).slice(0, 10);
      imagenesSeleccionadas = files;
      previsualizacion.innerHTML = '';

      files.forEach((file) => {
        const reader = new FileReader();
        const wrapper = document.createElement('div');
        wrapper.style.cssText =
          'width: 80px; height: 80px; border-radius: 8px; overflow: hidden; border: 1px solid #dee2e6;';

        reader.onload = (e) => {
          const img = document.createElement('img');
          img.src = e.target.result;
          img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
          wrapper.appendChild(img);
        };

        reader.readAsDataURL(file);
        previsualizacion.appendChild(wrapper);
      });
    });

    // Character counters + rehabilitar botón al corregir título
    document.getElementById('titulo').addEventListener('input', function () {
      document.getElementById('contador-titulo').textContent =
        this.value.length + '/100';
      if (this.value.trim()) {
        this.classList.remove('is-invalid');
        document.getElementById('btn-guardar').disabled = false;
      }
    });
    document
      .getElementById('descripcion')
      .addEventListener('input', function () {
        document.getElementById('contador-descripcion').textContent =
          this.value.length + '/500';
      });

    // Phone: digits only
    document.getElementById('telefono').addEventListener('input', function () {
      this.value = this.value.replace(/\D/g, '').slice(0, 15);
    });

    // Form submit
    document
      .getElementById('form-incidencia')
      .addEventListener('submit', async function (e) {
        e.preventDefault();

        const form = this;
        let valido = true;

        // Validar título explícitamente para mostrar mensaje y deshabilitar botón
        const tituloEl = document.getElementById('titulo');
        if (!tituloEl.value.trim()) {
          tituloEl.classList.add('is-invalid');
          document.getElementById('btn-guardar').disabled = true;
          valido = false;
        } else {
          tituloEl.classList.remove('is-invalid');
        }

        if (!document.getElementById('latitud').value) {
          document.getElementById('error-mapa').classList.remove('d-none');
          valido = false;
        }

        // Validar ubicación jerárquica
        const ciudadVal = document.getElementById('ciudad').value;
        const provinciaVal = document.getElementById('provincia').value;
        const paisVal = document.getElementById('pais').value;
        if (!ciudadVal && !provinciaVal && !paisVal) {
          document.getElementById('pais').classList.add('is-invalid');
          valido = false;
        } else {
          document.getElementById('pais').classList.remove('is-invalid');
        }

        const telEl = document.getElementById('telefono');
        if (telEl.value !== '' && telEl.value.length < 7) {
          telEl.classList.add('is-invalid');
          telEl.classList.remove('is-valid');
          valido = false;
        } else {
          telEl.classList.remove('is-invalid');
          if (telEl.value !== '') telEl.classList.add('is-valid');
        }

        if (!form.checkValidity()) valido = false;
        form.classList.add('was-validated');
        if (!valido) return;

        document.getElementById('btn-texto').classList.add('d-none');
        document.getElementById('btn-loading').classList.remove('d-none');
        document.getElementById('btn-guardar').disabled = true;

        const subtipoId = document.getElementById('subtipo').value;
        const priorityMap = { alta: 'high', media: 'medium', baja: 'low' };
        const lng = parseFloat(document.getElementById('longitud').value);
        const lat = parseFloat(document.getElementById('latitud').value);
        const locationId = parseInt(
          document.getElementById('ciudad').value ||
          document.getElementById('provincia').value ||
          document.getElementById('pais').value,
          10,
        );
        const payload = {
          title: document.getElementById('titulo').value.trim(),
          description: document.getElementById('descripcion').value.trim(),
          priority: priorityMap[document.getElementById('prioridad').value] || 'medium',
          incident_category_id: parseInt(subtipoId || document.getElementById('tipo').value, 10),
          geom: JSON.stringify({ type: 'Point', coordinates: [lng, lat] }),
          location_id: locationId || null,
        };

        // Si hay imágenes, usar FormData (multipart)
        const hasImages = imagenesSeleccionadas.length > 0;
        let body;

        if (hasImages) {
          body = new FormData();
          for (const [key, val] of Object.entries(payload)) {
            if (val !== null && val !== '') {
              body.append(key, val);
            }
          }
          imagenesSeleccionadas.forEach((file) => body.append('images[]', file));
        } else {
          body = payload;
        }

        try {
          const resp = await http.post('/incidents', body);
          const newId = resp.data?.id ?? resp.id;
          const toastEl = document.getElementById('toast-exito');
          new bootstrap.Toast(toastEl, { delay: 2000 }).show();
          setTimeout(() => {
            window.location.hash = newId ? `#/incidencias/${newId}` : '#/incidencias';
          }, 2000);
        } catch (err) {
          console.error('Error al guardar incidencia:', err);
          alert('No se pudo guardar la incidencia. Intente nuevamente.');
        } finally {
          document.getElementById('btn-texto').classList.remove('d-none');
          document.getElementById('btn-loading').classList.add('d-none');
          document.getElementById('btn-guardar').disabled = false;
        }
      });
  },

  onDestroy() {},
});
