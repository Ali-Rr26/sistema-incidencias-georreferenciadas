import { defineComponent } from '../../../../utils/component.js';
import { http } from '../../../../core/http.service.js';
import { router } from '../../../../core/router.js';
import { initSelect, destroyAll } from '../../../../shared/select-search.js';

export default defineComponent({
    templateUrl: 'app/configuracion/usuarios/pages/form/usuarios.form.component.html',

    async onInit() {
        const esEdicion = router.queryParams.has('id');
        const userId = router.queryParams.get('id');

        const titulo = document.getElementById('form-titulo');
        const cardTitulo = document.getElementById('card-titulo');
        const breadcrumb = document.getElementById('breadcrumb-actual');

        if (esEdicion) {
            titulo.textContent = 'Editar Usuario';
            cardTitulo.textContent = 'Editar Usuario';
            breadcrumb.textContent = 'Editar';
        }

        function mostrarToast(mensaje, tipo) {
            const el = document.getElementById('toast-msg');
            el.className = `toast align-items-center text-white border-0 bg-${tipo}`;
            document.getElementById('toast-msg-texto').textContent = mensaje;
            new bootstrap.Toast(el, { delay: 3000 }).show();
        }

        // ─── Configurar password según modo ──────────────────────────────

        function configurarPassword(edicion) {
            const passEl = document.getElementById('user-password');
            const req = document.getElementById('pass-requerido');
            if (edicion) {
                passEl.removeAttribute('required');
                passEl.placeholder = 'Dejar vacío para no cambiar';
                req.classList.add('d-none');
            } else {
                passEl.setAttribute('required', '');
                passEl.placeholder = 'Mínimo 8 caracteres';
                req.classList.remove('d-none');
            }
        }

        configurarPassword(esEdicion);

        // ─── Cargar roles ────────────────────────────────────────────────

        async function cargarRoles() {
            const resp = await http.get('/roles?per_page=100');
            const roles = resp.data ?? resp;
            const sel = document.getElementById('user-rol');
            sel.innerHTML = '<option value="">-- Seleccione --</option>';
            roles.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.id;
                opt.textContent = r.name;
                sel.appendChild(opt);
            });
        }

        await cargarRoles();

        // ─── Si edición, cargar datos ────────────────────────────────────

        if (esEdicion) {
            try {
                const resp = await http.get('/users/' + userId);
                const u = resp.data ?? resp;
                document.getElementById('user-id').value = u.id;
                document.getElementById('user-nombre').value = u.first_name ?? '';
                document.getElementById('user-apellido').value = u.last_name ?? '';
                document.getElementById('user-email').value = u.email;
                document.getElementById('user-telefono').value = u.phone ?? '';
                document.getElementById('user-rol').value = u.role?.id ?? '';
            } catch {
                mostrarToast('Error al cargar el usuario.', 'danger');
            }
        }

        // ─── Tom Select ───────────────────────────────────────────────────
        initSelect('user-rol', { placeholder: 'Buscar rol...' });

        // ─── Submit ──────────────────────────────────────────────────────

        document.getElementById('form-user').addEventListener('submit', async function (e) {
            e.preventDefault();
            if (!this.checkValidity()) { this.classList.add('was-validated'); return; }

            const id = document.getElementById('user-id').value;
            const password = document.getElementById('user-password').value;
            const payload = {
                first_name: document.getElementById('user-nombre').value.trim(),
                last_name: document.getElementById('user-apellido').value.trim(),
                email: document.getElementById('user-email').value.trim(),
                role_id: parseInt(document.getElementById('user-rol').value),
                phone: document.getElementById('user-telefono').value.trim() || null,
            };
            if (!id || password) payload.password = password;

            document.getElementById('user-btn-texto').classList.add('d-none');
            document.getElementById('user-btn-loading').classList.remove('d-none');
            document.getElementById('btn-guardar-user').disabled = true;

            try {
                if (id) {
                    await http.put('/users/' + id, payload);
                } else {
                    await http.post('/users', payload);
                }
                mostrarToast(id ? 'Usuario actualizado.' : 'Usuario creado.', 'success');
                router.navigate('/usuarios');
            } catch (err) {
                mostrarToast(err.message ?? 'No se pudo guardar.', 'danger');
            } finally {
                document.getElementById('user-btn-texto').classList.remove('d-none');
                document.getElementById('user-btn-loading').classList.add('d-none');
                document.getElementById('btn-guardar-user').disabled = false;
            }
        });
    },

    onDestroy() { destroyAll(); }
});
