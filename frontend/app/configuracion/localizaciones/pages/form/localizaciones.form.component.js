import { defineComponent } from '../../../../utils/component.js';
import { http } from '../../../../core/http.service.js';
import { router } from '../../../../core/router.js';
import { initSelect, destroyAll } from '../../../../shared/select-search.js';

const NIVEL_LABELS = { country: 'País', province: 'Provincia', city: 'Ciudad', neighborhood: 'Barrio' };

export default defineComponent({
    templateUrl: 'app/configuracion/localizaciones/pages/form/localizaciones.form.component.html',

    async onInit() {
        const esEdicion = router.queryParams.has('id');
        const locId = router.queryParams.get('id');

        const titulo = document.getElementById('form-titulo');
        const cardTitulo = document.getElementById('card-titulo');
        const breadcrumb = document.getElementById('breadcrumb-actual');

        if (esEdicion) {
            titulo.textContent = 'Editar Localización';
            cardTitulo.textContent = 'Editar Localización';
            breadcrumb.textContent = 'Editar';
        }

        function mostrarToast(mensaje, tipo) {
            const el = document.getElementById('toast-msg');
            el.className = `toast align-items-center text-white border-0 bg-${tipo}`;
            document.getElementById('toast-msg-texto').textContent = mensaje;
            new bootstrap.Toast(el, { delay: 3000 }).show();
        }

        async function cargarPadres(exceptId = null) {
            const resp = await http.get('/locations?per_page=500');
            const locs = resp.data ?? resp;
            const sel = document.getElementById('loc-padre');
            sel.innerHTML = '<option value="">-- Ninguna (raíz) --</option>';
            locs
                .filter(l => l.id !== parseInt(exceptId))
                .forEach(l => {
                    const opt = document.createElement('option');
                    opt.value = l.id;
                    opt.textContent = `${l.name} (${NIVEL_LABELS[l.level] ?? l.level})`;
                    sel.appendChild(opt);
                });
        }

        await cargarPadres(locId);

        if (esEdicion) {
            try {
                const resp = await http.get('/locations/' + locId);
                const loc = resp.data ?? resp;
                document.getElementById('loc-id').value = loc.id;
                document.getElementById('loc-nombre').value = loc.name;
                document.getElementById('loc-codigo').value = loc.code ?? '';
                document.getElementById('loc-nivel').value = loc.level;
                document.getElementById('loc-padre').value = loc.parent_id ?? '';
            } catch {
                mostrarToast('Error al cargar la localización.', 'danger');
            }
        }

        // ─── Tom Select ───────────────────────────────────────────────────
        initSelect('loc-padre', { placeholder: 'Buscar ubicación padre...' });

        document.getElementById('form-loc').addEventListener('submit', async function (e) {
            e.preventDefault();
            if (!this.checkValidity()) { this.classList.add('was-validated'); return; }

            const id = document.getElementById('loc-id').value;
            const padreVal = document.getElementById('loc-padre').value;
            const payload = {
                name: document.getElementById('loc-nombre').value.trim(),
                code: document.getElementById('loc-codigo').value.trim(),
                level: document.getElementById('loc-nivel').value,
                parent_id: padreVal ? parseInt(padreVal) : null,
            };

            document.getElementById('loc-btn-texto').classList.add('d-none');
            document.getElementById('loc-btn-loading').classList.remove('d-none');
            document.getElementById('btn-guardar-loc').disabled = true;

            try {
                if (id) {
                    await http.put('/locations/' + id, payload);
                } else {
                    await http.post('/locations', payload);
                }
                mostrarToast(id ? 'Localización actualizada.' : 'Localización creada.', 'success');
                router.navigate('/localizaciones');
            } catch (err) {
                mostrarToast(err.message ?? 'No se pudo guardar.', 'danger');
            } finally {
                document.getElementById('loc-btn-texto').classList.remove('d-none');
                document.getElementById('loc-btn-loading').classList.add('d-none');
                document.getElementById('btn-guardar-loc').disabled = false;
            }
        });
    },

    onDestroy() { destroyAll(); }
});
