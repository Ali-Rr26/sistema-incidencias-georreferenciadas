import { defineComponent } from '../../../utils/component.js';
import { http } from '../../../core/http.service.js';

const SUBTIPOS = {
  infraestructura: ['Bache / Pavimento', 'Alumbrado público', 'Puentes / Vías', 'Edificios públicos'],
  seguridad:       ['Robo / Asalto', 'Vandalismo', 'Zona de riesgo', 'Violencia doméstica'],
  ambiental:       ['Basura / Desechos', 'Contaminación del agua', 'Deforestación', 'Ruido excesivo'],
  servicios:       ['Falla de agua', 'Falla eléctrica', 'Falla de gas', 'Internet / Telefonía']
};

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
    const mapa = L.map('mapa-incidencia').setView([mapaInicial.lat, mapaInicial.lng], mapaInicial.zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
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

    mapa.on('click', e => colocarMarcador(e.latlng.lat, e.latlng.lng));

    // Geolocation
    document.getElementById('btn-geolocalizacion').addEventListener('click', function () {
      if (!navigator.geolocation) { alert('Su navegador no soporta geolocalización.'); return; }
      const btn = this;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Detectando...';

      navigator.geolocation.getCurrentPosition(
        pos => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          mapa.setView([lat, lng], 16);
          colocarMarcador(lat, lng);
          btn.disabled = false;
          btn.innerHTML = '<i data-feather="navigation" class="feather-icon me-1"></i> Usar mi ubicación actual';
          if (window.feather) feather.replace();
        },
        () => {
          alert('No se pudo obtener la ubicación. Verifique los permisos del navegador.');
          btn.disabled = false;
          btn.innerHTML = '<i data-feather="navigation" class="feather-icon me-1"></i> Usar mi ubicación actual';
          if (window.feather) feather.replace();
        }
      );
    });

    // Cascada Tipo → Subtipo
    function poblarSelect(selectEl, opciones, placeholder) {
      selectEl.innerHTML = `<option value="">${placeholder}</option>`;
      opciones.forEach(op => {
        const opt = document.createElement('option');
        opt.value = op;
        opt.textContent = op;
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
      if (this.value && SUBTIPOS[this.value]) {
        poblarSelect(subtipoEl, SUBTIPOS[this.value], '-- Seleccione subtipo --');
      } else {
        resetSelect(subtipoEl, '-- Seleccione tipo primero --');
      }
    });

    // Character counters + rehabilitar botón al corregir título
    document.getElementById('titulo').addEventListener('input', function () {
      document.getElementById('contador-titulo').textContent = this.value.length + '/100';
      if (this.value.trim()) {
        this.classList.remove('is-invalid');
        document.getElementById('btn-guardar').disabled = false;
      }
    });
    document.getElementById('descripcion').addEventListener('input', function () {
      document.getElementById('contador-descripcion').textContent = this.value.length + '/500';
    });

    // Phone: digits only
    document.getElementById('telefono').addEventListener('input', function () {
      this.value = this.value.replace(/\D/g, '').slice(0, 15);
    });

    // Form submit
    document.getElementById('form-incidencia').addEventListener('submit', async function (e) {
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

      const payload = {
        titulo:      document.getElementById('titulo').value.trim(),
        descripcion: document.getElementById('descripcion').value.trim(),
        prioridad:   document.getElementById('prioridad').value,
        telefono:    document.getElementById('telefono').value || null,
        tipo:        document.getElementById('tipo').value,
        subtipo:     document.getElementById('subtipo').value,
        latitud:     parseFloat(document.getElementById('latitud').value),
        longitud:    parseFloat(document.getElementById('longitud').value),
        direccion:   document.getElementById('direccion').value.trim() || null
      };

      try {
        await http.post('/incidencias', payload);
        const toastEl = document.getElementById('toast-exito');
        new bootstrap.Toast(toastEl, { delay: 2000 }).show();
        if (window.feather) feather.replace();
        setTimeout(() => { window.location.hash = '#/incidencias'; }, 2000);
      } catch (err) {
        console.error('Error al guardar incidencia:', err);
        alert('No se pudo guardar la incidencia. Intente nuevamente.');
      } finally {
        document.getElementById('btn-texto').classList.remove('d-none');
        document.getElementById('btn-loading').classList.add('d-none');
        document.getElementById('btn-guardar').disabled = false;
      }
    });

    if (window.feather) feather.replace();
  },

  onDestroy() {}
});
