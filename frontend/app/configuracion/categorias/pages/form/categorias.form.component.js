import { defineComponent } from '../../../../utils/component.js';
import { http } from '../../../../core/http.service.js';
import { router } from '../../../../core/router.js';
import { initSelect, destroyAll } from '../../../../shared/select-search.js';

export default defineComponent({
    templateUrl: 'app/configuracion/categorias/pages/form/categorias.form.component.html',

    async onInit() {
        const esEdicion = router.queryParams.has('id');
        const catId = router.queryParams.get('id');

        const titulo = document.getElementById('form-titulo');
        const cardTitulo = document.getElementById('card-titulo');
        const breadcrumb = document.getElementById('breadcrumb-actual');

        if (esEdicion) {
            titulo.textContent = 'Editar Categoría';
            cardTitulo.textContent = 'Editar Categoría';
            breadcrumb.textContent = 'Editar';
        }

        function mostrarToast(mensaje, tipo) {
            const el = document.getElementById('toast-msg');
            el.className = `toast align-items-center text-white border-0 bg-${tipo}`;
            document.getElementById('toast-msg-texto').textContent = mensaje;
            new bootstrap.Toast(el, { delay: 3000 }).show();
        }

        // ─── Cargar categorías padre ─────────────────────────────────────

        async function cargarPadres(exceptId = null) {
            const resp = await http.get('/incident-categories?per_page=200');
            const cats = resp.data ?? resp;
            const sel = document.getElementById('cat-padre');
            sel.innerHTML = '<option value="">-- Ninguna (raíz) --</option>';
            cats
                .filter(c => c.id !== parseInt(exceptId))
                .forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.id;
                    opt.textContent = c.name;
                    sel.appendChild(opt);
                });
        }

        await cargarPadres(catId);

        // ─── Si edición, cargar datos ────────────────────────────────────

        if (esEdicion) {
            try {
                const resp = await http.get('/incident-categories/' + catId);
                const cat = resp.data ?? resp;
                document.getElementById('cat-id').value = cat.id;
                document.getElementById('cat-nombre').value = cat.name;
                document.getElementById('cat-padre').value = cat.parent_id ?? '';
            } catch {
                mostrarToast('Error al cargar la categoría.', 'danger');
            }
        }

        // ─── Tom Select (búsqueda en selects) ─────────────────────────────
        initSelect('cat-padre', { placeholder: 'Buscar categoría padre...' });

        // ─── Submit ──────────────────────────────────────────────────────

        document.getElementById('form-cat').addEventListener('submit', async function (e) {
            e.preventDefault();
            if (!this.checkValidity()) { this.classList.add('was-validated'); return; }

            const id = document.getElementById('cat-id').value;
            const padreVal = document.getElementById('cat-padre').value;
            const payload = {
                name: document.getElementById('cat-nombre').value.trim(),
                parent_id: padreVal ? parseInt(padreVal) : null,
            };

            document.getElementById('cat-btn-texto').classList.add('d-none');
            document.getElementById('cat-btn-loading').classList.remove('d-none');
            document.getElementById('btn-guardar-cat').disabled = true;

            try {
                if (id) {
                    await http.put('/incident-categories/' + id, payload);
                } else {
                    await http.post('/incident-categories', payload);
                }
                mostrarToast(id ? 'Categoría actualizada.' : 'Categoría creada.', 'success');
                router.navigate('/categorias');
            } catch (err) {
                mostrarToast(err.message ?? 'No se pudo guardar.', 'danger');
            } finally {
                document.getElementById('cat-btn-texto').classList.remove('d-none');
                document.getElementById('cat-btn-loading').classList.add('d-none');
                document.getElementById('btn-guardar-cat').disabled = false;
            }
        });
    },

    onDestroy() { destroyAll(); }
});
