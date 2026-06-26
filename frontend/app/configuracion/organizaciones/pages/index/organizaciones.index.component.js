import { defineComponent } from '../../../../utils/component.js';
import { http } from '../../../../core/http.service.js';
import { renderPaginacion } from '../../../../shared/pagination/pagination.js';

const POR_PAGINA = 15;

export default defineComponent({
    templateUrl: 'app/configuracion/organizaciones/pages/index/organizaciones.index.component.html',

    async onInit() {
        let paginaActual = 1;
        let totalPaginas = 1;
        let idEliminar = null;
        let localizaciones = [];

        function mostrarToast(mensaje, tipo) {
            const el = document.getElementById('toast-msg');
            el.className = `toast align-items-center text-white border-0 bg-${tipo}`;
            document.getElementById('toast-msg-texto').textContent = mensaje;
            new bootstrap.Toast(el, { delay: 3000 }).show();
        }

        function mostrarEstado(cual) {
            ['cargando', 'vacio', 'error', 'tabla'].forEach(s => {
                const el = document.getElementById(s === 'tabla' ? 'contenedor-tabla' : 'estado-' + s);
                if (el) el.classList.toggle('d-none', s !== cual);
            });
            if (window.feather) feather.replace();
        }

        function formatearFecha(iso) {
            if (!iso) return '—';
            return new Date(iso).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }

        function renderTabla(datos, total) {
            if (!datos || datos.length === 0) { mostrarEstado('vacio'); return; }

            const tbody = document.getElementById('tabla-body');
            tbody.innerHTML = datos.map(org => `
                <tr>
                    <td class="ps-3 text-muted small">${org.id}</td>
                    <td class="fw-semibold">${org.name}</td>
                    <td class="text-muted small">${org.location?.name ?? '—'}</td>
                    <td class="small text-muted">${formatearFecha(org.created_at)}</td>
                    <td class="text-center">
                        <div class="d-flex justify-content-center gap-1">
                            <button class="btn btn-sm btn-outline-secondary btn-editar"
                                data-id="${org.id}" data-nombre="${org.name}" data-location="${org.location_id}">
                                <i class="fas fa-pencil-alt"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger btn-eliminar"
                                data-id="${org.id}" data-nombre="${org.name}">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </td>
                </tr>`).join('');

            const cards = document.getElementById('contenedor-cards');
            cards.innerHTML = datos.map(org => `
                <div class="card mb-2 shadow-sm">
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <h6 class="mb-0">${org.name}</h6>
                                <small class="text-muted">${org.location?.name ?? '—'}</small>
                            </div>
                            <div class="d-flex gap-1">
                                <button class="btn btn-sm btn-outline-secondary btn-editar"
                                    data-id="${org.id}" data-nombre="${org.name}" data-location="${org.location_id}">
                                    <i class="fas fa-pencil-alt"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger btn-eliminar"
                                    data-id="${org.id}" data-nombre="${org.name}">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>`).join('');

            const desde = (paginaActual - 1) * POR_PAGINA + 1;
            const hasta = Math.min(paginaActual * POR_PAGINA, total);
            document.getElementById('info-resultados').textContent = `Mostrando ${desde}–${hasta} de ${total}`;
            renderPaginacion(document.getElementById('paginacion'), paginaActual, totalPaginas, cargar);
            mostrarEstado('tabla');
            if (window.feather) feather.replace();
        }

        async function cargar(pagina = 1) {
            paginaActual = pagina;
            mostrarEstado('cargando');
            const params = new URLSearchParams({
                page: paginaActual,
                per_page: POR_PAGINA,
                search: document.getElementById('filtro-buscar').value.trim(),
            });
            try {
                const resp = await http.get('/organizations?' + params.toString());
                const datos = resp.data ?? resp;
                const total = resp.meta?.total ?? resp.total ?? datos.length;
                totalPaginas = Math.ceil(total / POR_PAGINA) || 1;
                renderTabla(datos, total);
            } catch {
                mostrarEstado('error');
            }
        }

        async function cargarLocalizaciones() {
            if (localizaciones.length) return;
            try {
                const resp = await http.get('/locations?per_page=200');
                localizaciones = resp.data ?? resp;
                const sel = document.getElementById('org-location');
                localizaciones.forEach(loc => {
                    const opt = document.createElement('option');
                    opt.value = loc.id;
                    opt.textContent = `${loc.name} (${loc.level})`;
                    sel.appendChild(opt);
                });
            } catch {
                mostrarToast('No se pudieron cargar las localizaciones.', 'warning');
            }
        }

        function abrirModalCrear() {
            document.getElementById('modal-org-titulo').textContent = 'Nueva Organización';
            document.getElementById('org-id').value = '';
            document.getElementById('org-nombre').value = '';
            document.getElementById('org-location').value = '';
            document.getElementById('form-org').classList.remove('was-validated');
            cargarLocalizaciones();
        }

        function abrirModalEditar(btn) {
            document.getElementById('modal-org-titulo').textContent = 'Editar Organización';
            document.getElementById('org-id').value = btn.dataset.id;
            document.getElementById('org-nombre').value = btn.dataset.nombre;
            document.getElementById('form-org').classList.remove('was-validated');
            cargarLocalizaciones().then(() => {
                document.getElementById('org-location').value = btn.dataset.location;
            });
            new bootstrap.Modal(document.getElementById('modal-org-form')).show();
            if (window.feather) feather.replace();
        }

        document.getElementById('modal-org-form').addEventListener('show.bs.modal', () => {
            if (window.feather) feather.replace();
        });

        document.querySelector('[data-bs-target="#modal-org-form"]').addEventListener('click', abrirModalCrear);

        document.getElementById('form-org').addEventListener('submit', async function (e) {
            e.preventDefault();
            if (!this.checkValidity()) { this.classList.add('was-validated'); return; }

            const id = document.getElementById('org-id').value;
            const payload = {
                name: document.getElementById('org-nombre').value.trim(),
                location_id: parseInt(document.getElementById('org-location').value),
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
                bootstrap.Modal.getInstance(document.getElementById('modal-org-form')).hide();
                mostrarToast(id ? 'Organización actualizada.' : 'Organización creada.', 'success');
                cargar(paginaActual);
            } catch (err) {
                mostrarToast(err.message ?? 'No se pudo guardar.', 'danger');
            } finally {
                document.getElementById('org-btn-texto').classList.remove('d-none');
                document.getElementById('org-btn-loading').classList.add('d-none');
                document.getElementById('btn-guardar-org').disabled = false;
            }
        });

        function delegarClicks(contenedor) {
            contenedor.addEventListener('click', e => {
                const editar = e.target.closest('.btn-editar');
                const eliminar = e.target.closest('.btn-eliminar');
                if (editar) abrirModalEditar(editar);
                if (eliminar) {
                    idEliminar = eliminar.dataset.id;
                    document.getElementById('modal-eliminar-nombre').textContent = eliminar.dataset.nombre;
                    new bootstrap.Modal(document.getElementById('modal-eliminar')).show();
                    if (window.feather) feather.replace();
                }
            });
        }

        delegarClicks(document.getElementById('tabla-body'));
        delegarClicks(document.getElementById('contenedor-cards'));

        document.getElementById('btn-confirmar-eliminar').addEventListener('click', async function () {
            if (!idEliminar) return;
            document.getElementById('eliminar-texto').classList.add('d-none');
            document.getElementById('eliminar-loading').classList.remove('d-none');
            this.disabled = true;
            try {
                await http.delete('/organizations/' + idEliminar);
                bootstrap.Modal.getInstance(document.getElementById('modal-eliminar')).hide();
                mostrarToast('Organización eliminada.', 'success');
                cargar(paginaActual);
            } catch {
                mostrarToast('No se pudo eliminar.', 'danger');
            } finally {
                document.getElementById('eliminar-texto').classList.remove('d-none');
                document.getElementById('eliminar-loading').classList.add('d-none');
                document.getElementById('btn-confirmar-eliminar').disabled = false;
            }
        });

        document.getElementById('btn-filtrar').addEventListener('click', () => cargar(1));
        document.getElementById('filtro-buscar').addEventListener('keydown', e => { if (e.key === 'Enter') cargar(1); });
        document.getElementById('btn-limpiar').addEventListener('click', () => {
            document.getElementById('filtro-buscar').value = '';
            cargar(1);
        });
        document.getElementById('btn-reintentar').addEventListener('click', () => cargar(paginaActual));

        if (window.feather) feather.replace();
        cargar(1);
    },

    onDestroy() {}
});
