import { defineComponent } from '../../../../utils/component.js';
import { http } from '../../../../core/http.service.js';
import { router } from '../../../../core/router.js';
import {
  initSelect,
  getSelect,
  clearSelect,
  destroyAll,
} from '../../../../shared/select-search.js';

export default defineComponent({
  templateUrl:
    'app/configuracion/organizaciones/pages/form/organizaciones.form.component.html',

  async onInit() {
    const editId = router.queryParams.get('id');
    const esEdicion = !!editId;

    // ─── Setear título dinámico ───────────────────────────────────────────
    document.getElementById('form-titulo').textContent = esEdicion
      ? 'Editar Organización'
      : 'Nueva Organización';
    document.getElementById('card-titulo').textContent = esEdicion
      ? 'Editar Organización'
      : 'Nueva Organización';
    document.getElementById('breadcrumb-actual').textContent = esEdicion
      ? 'Editar'
      : 'Crear';

    function mostrarToast(mensaje, tipo) {
      const el = document.getElementById('toast-msg');
      el.className = `toast align-items-center text-white border-0 bg-${tipo}`;
      document.getElementById('toast-msg-texto').textContent = mensaje;
      new bootstrap.Toast(el, { delay: 3000 }).show();
    }

    // ─── Cargar organizaciones padre ──────────────────────────────────────
    async function cargarPadres(exceptId = null) {
      try {
        const resp = await http.get('/organizations?per_page=200');
        const orgs = resp.data ?? resp;
        const sel = document.getElementById('org-padre');
        sel.innerHTML = '<option value="">-- Ninguna (raíz) --</option>';
        orgs
          .filter((o) => o.id !== parseInt(exceptId))
          .forEach((o) => {
            const opt = document.createElement('option');
            opt.value = o.id;
            opt.textContent = o.name;
            sel.appendChild(opt);
          });
      } catch {
        mostrarToast(
          'No se pudieron cargar las organizaciones padre.',
          'warning',
        );
      }
    }

    // ─── Localización en cascada ──────────────────────────────────────────

    let locationTree = null;

    async function cargarArbolLocations() {
      if (locationTree) return;
      const resp = await http.get('/locations/tree');
      locationTree = resp.data ?? resp;
    }

    function findNodeById(nodes, id) {
      for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children?.length) {
          const found = findNodeById(node.children, id);
          if (found) return found;
        }
      }
      return null;
    }

    function findAncestors(tree, targetId, path = []) {
      for (const node of tree) {
        if (node.id === targetId) return [...path, node];
        if (node.children?.length) {
          const found = findAncestors(node.children, targetId, [...path, node]);
          if (found) return found;
        }
      }
      return null;
    }

    function poblarSelectNativo(selId, items, textoDefault) {
      const sel = document.getElementById(selId);
      sel.innerHTML =
        `<option value="">${textoDefault}</option>` +
        items.map((i) => `<option value="${i.id}">${i.name}</option>`).join('');
    }

    function setSelectEnabled(selId, enabled) {
      const sel = document.getElementById(selId);
      if (enabled) {
        sel.removeAttribute('disabled');
      } else {
        sel.setAttribute('disabled', '');
      }
    }

    // ─── Cargar categorías (multi-select) ────────────────────────────

    async function cargarCategorias(valoresSeleccionados = []) {
      try {
        const resp = await http.get('/incident-categories?per_page=200');
        const cats = resp.data ?? resp;
        const sel = document.getElementById('org-categorias');
        sel.innerHTML = cats
          .map(
            (c) =>
              `<option value="${c.id}" ${valoresSeleccionados.includes(c.id) ? 'selected' : ''}>${c.name}</option>`,
          )
          .join('');

        initSelect('org-categorias', {
          placeholder: 'Buscar categorías...',
          maxItems: null,
          plugins: ['remove_button'],
        });
      } catch {
        mostrarToast('No se pudieron cargar las categorías.', 'warning');
      }
    }

    const paisSel = 'org-location-pais';
    const provinciaSel = 'org-location-provincia';
    const ciudadSel = 'org-location-ciudad';

    function onPaisChange() {
      const val = document.getElementById(paisSel).value;
      clearSelect(provinciaSel);
      clearSelect(ciudadSel);
      if (val) {
        const pais = findNodeById(locationTree, parseInt(val));
        poblarSelectNativo(
          provinciaSel,
          pais?.children ?? [],
          '-- Seleccione --',
        );
        setSelectEnabled(provinciaSel, true);
        initSelect(provinciaSel, { placeholder: 'Buscar provincia...' });
        poblarSelectNativo(ciudadSel, [], '-- Opcional --');
        setSelectEnabled(ciudadSel, false);
      } else {
        setSelectEnabled(provinciaSel, false);
        setSelectEnabled(ciudadSel, false);
      }
      actualizarLocationId();
    }

    function onProvinciaChange() {
      const val = document.getElementById(provinciaSel).value;
      clearSelect(ciudadSel);
      if (val) {
        const pais = findNodeById(
          locationTree,
          parseInt(document.getElementById(paisSel).value),
        );
        const provincia = pais?.children?.find((c) => c.id === parseInt(val));
        poblarSelectNativo(
          ciudadSel,
          provincia?.children ?? [],
          '-- Opcional --',
        );
        setSelectEnabled(ciudadSel, true);
        initSelect(ciudadSel, { placeholder: 'Buscar ciudad...' });
      } else {
        setSelectEnabled(ciudadSel, false);
      }
      actualizarLocationId();
    }

    function onCiudadChange() {
      actualizarLocationId();
    }

    function actualizarLocationId() {
      const ciudad = document.getElementById(ciudadSel).value;
      const provincia = document.getElementById(provinciaSel).value;
      const pais = document.getElementById(paisSel).value;
      document.getElementById('org-location').value =
        ciudad || provincia || pais;
    }

    async function initCascadingLocation(valorSeleccionado = null) {
      await cargarArbolLocations();
      if (!locationTree?.length) return;

      // Poblar países
      poblarSelectNativo(paisSel, locationTree, '-- Seleccione --');
      initSelect(paisSel, { placeholder: 'Buscar país...' });

      // Si hay valor seleccionado (edición), resolver ancestros
      if (valorSeleccionado) {
        const ancestors = findAncestors(
          locationTree,
          parseInt(valorSeleccionado),
        );
        if (ancestors) {
          const nivelPais = ancestors.find((a) => a.level === 'country');
          const nivelProvincia = ancestors.find((a) => a.level === 'province');
          const nivelCiudad = ancestors.find((a) => a.level === 'city');

          if (nivelPais) {
            getSelect(paisSel)?.setValue(String(nivelPais.id), true);
            // El change event no se dispara con setValue silencioso,
            // así que llamamos onPaisChange manualmente
            onPaisChange();
          }
          if (nivelProvincia) {
            getSelect(provinciaSel)?.setValue(String(nivelProvincia.id), true);
            onProvinciaChange();
          }
          if (nivelCiudad) {
            getSelect(ciudadSel)?.setValue(String(nivelCiudad.id), true);
          }
          document.getElementById('org-location').value = valorSeleccionado;
        }
      }

      // Eventos (se agregan después de la inicialización)
      document.getElementById(paisSel).addEventListener('change', onPaisChange);
      document
        .getElementById(provinciaSel)
        .addEventListener('change', onProvinciaChange);
      document
        .getElementById(ciudadSel)
        .addEventListener('change', onCiudadChange);
    }

    // ─── Carga inicial ────────────────────────────────────────────────────

    if (esEdicion) {
      try {
        const resp = await http.get('/organizations/' + editId);
        const org = resp.data ?? resp;
        document.getElementById('org-id').value = org.id;
        document.getElementById('org-nombre').value = org.name;

        const categoriasIds = (org.incident_categories ?? []).map((c) => c.id);

        await Promise.all([
          cargarPadres(editId),
          initCascadingLocation(org.location_id),
          cargarCategorias(categoriasIds),
        ]);
        document.getElementById('org-padre').value = org.parent_id ?? '';
      } catch {
        mostrarToast('No se pudo cargar la organización.', 'danger');
        return;
      }
    } else {
      await Promise.all([
        cargarPadres(),
        initCascadingLocation(),
        cargarCategorias(),
      ]);
    }

    // ─── Tom Select en org-padre ──────────────────────────────────────────
    initSelect('org-padre', { placeholder: 'Buscar organización...' });

    // ─── Submit ───────────────────────────────────────────────────────────
    document
      .getElementById('form-org')
      .addEventListener('submit', async function (e) {
        e.preventDefault();
        if (!this.checkValidity()) {
          this.classList.add('was-validated');
          return;
        }

        const id = document.getElementById('org-id').value;
        const padreVal = document.getElementById('org-padre').value;
        const locationId = document.getElementById('org-location').value;

        if (!locationId) {
          mostrarToast('Debe seleccionar al menos un país.', 'warning');
          return;
        }

        const catSelect = getSelect('org-categorias');
        const categoryIds = catSelect ? catSelect.getValue().map(Number) : [];

        const payload = {
          name: document.getElementById('org-nombre').value.trim(),
          location_id: parseInt(locationId),
          parent_id: padreVal ? parseInt(padreVal) : null,
          category_ids: categoryIds,
        };

        document.getElementById('org-btn-texto').classList.add('d-none');
        document.getElementById('org-btn-loading').classList.remove('d-none');
        document.getElementById('btn-guardar-org').disabled = true;

        try {
          if (id) {
            await http.put('/organizations/' + id, payload);
          } else {
            await http.post('/organizations', payload);
          }
          mostrarToast(
            id ? 'Organización actualizada.' : 'Organización creada.',
            'success',
          );
          setTimeout(() => {
            router.navigate('/organizaciones');
          }, 800);
        } catch (err) {
          mostrarToast(err.message ?? 'No se pudo guardar.', 'danger');
        } finally {
          document.getElementById('org-btn-texto').classList.remove('d-none');
          document.getElementById('org-btn-loading').classList.add('d-none');
          document.getElementById('btn-guardar-org').disabled = false;
        }
      });
  },

  onDestroy() {
    destroyAll();
  },
});
