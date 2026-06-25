import { defineComponent } from '../../../../utils/component.js';
import { http } from '../../../../core/http.service.js';
import { renderPaginacion } from '../../../../shared/pagination/pagination.js';

const POR_PAGINA = 15;
const NIVEL_LABELS = { country: 'País', province: 'Provincia', city: 'Ciudad', neighborhood: 'Barrio' };

export default defineComponent({
    templateUrl: 'app/configuracion/localizaciones/pages/index/localizaciones.index.component.html',

    async onInit() {
        let paginaActual = 1;
        let totalPaginas = 1;
        let idEliminar = null;
        let todasLasLocs = [];
        const modal = () => bootstrap.Modal.getOrCreateInstance(document.getElementById('modal-loc-form'));

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

        function nivelBadge(level) {
            const map = { country: 'primary', province: 'info', city: 'success', neighborhood: 'secondary' };
            return `<span class="badge bg-${map[level] ?? 'secondary'}">${NIVEL_LABELS[level] ?? level}</span>`;
        }

        function renderTabla(datos, total) {
            if (!datos || datos.length === 0) { mostrarEstado('vacio'); return; }

            document.getElementById('tabla-body').innerHTML = datos.map(loc => `
                <tr>
                    <td class="ps-3 text-muted small">${loc.id}</td>
                    <td class="fw-semibold">${loc.name}</td>
                    <td><code class="small">${loc.code ?? '—'}</code></td>
                    <td>${nivelBadge(loc.level)}</td>
                    <td class="text-muted small">${loc.parent?.name ?? '—'}</td>
                    <td class="text-center">
                        <div class="d-flex justify-content-center gap-1">
                            <button class="btn btn-sm btn-outline-secondary btn-editar"
                                data-id="${loc.id}" data-nombre="${loc.name}" data-codigo="${loc.code ?? ''}"
                                data-nivel="${loc.level}" data-padre="${loc.parent_id ?? ''}">
                                <i data-feather="edit-2" class="feather-icon"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger btn-eliminar"
                                data-id="${loc.id}" data-nombre="${loc.name}">
                                <i data-feather="trash-2" class="feather-icon"></i>
                            </button>
                        </div>
                    </td>
                </tr>`).join('');

            document.getElementById('contenedor-cards').innerHTML = datos.map(loc => `
                <div class="card mb-2 shadow-sm">
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <h6 class="mb-0">${loc.name} <code class="small">${loc.code ?? ''}</code></h6>
                                <div class="mt-1">${nivelBadge(loc.level)}</div>
                                ${loc.parent ? `<small class="text-muted">Padre: ${loc.parent.name}</small>` : ''}
                            </div>
                            <div class="d-flex gap-1">
                                <button class="btn btn-sm btn-outline-secondary btn-editar"
                                    data-id="${loc.id}" data-nombre="${loc.name}" data-codigo="${loc.code ?? ''}"
                                    data-nivel="${loc.level}" data-padre="${loc.parent_id ?? ''}">
                                    <i data-feather="edit-2" class="feather-icon"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger btn-eliminar"
                                    data-id="${loc.id}" data-nombre="${loc.name}">
                                    <i data-feather="trash-2" class="feather-icon"></i>
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
                level: document.getElementById('filtro-nivel').value,
            });
            try {
                const resp = await http.get('/locations?' + params.toString());
                const datos = resp.data ?? resp;
                const total = resp.meta?.total ?? resp.total ?? datos.length;
                totalPaginas = Math.ceil(total / POR_PAGINA) || 1;
                renderTabla(datos, total);
            } catch {
                mostrarEstado('error');
            }
        }

        async function cargarPadres(excluirId = null) {
            if (!todasLasLocs.length) {
                const resp = await http.get('/locations?per_page=200');
                todasLasLocs = resp.data ?? resp;
            }
            const sel = document.getElementById('loc-padre');
            sel.innerHTML = '<option value="">-- Ninguna (raíz) --</option>';
            todasLasLocs
                .filter(l => l.id !== parseInt(excluirId))
                .forEach(l => {
                    const opt = document.createElement('option');
                    opt.value = l.id;
                    opt.textContent = `${l.name} (${NIVEL_LABELS[l.level] ?? l.level})`;
                    sel.appendChild(opt);
                });
        }

        function limpiarModal() {
            document.getElementById('loc-id').value = '';
            document.getElementById('loc-nombre').value = '';
            document.getElementById('loc-codigo').value = '';
            document.getElementById('loc-nivel').value = '';
            document.getElementById('form-loc').classList.remove('was-validated');
        }

        document.getElementById('btn-nueva-loc').addEventListener('click', async () => {
            document.getElementById('modal-loc-titulo').textContent = 'Nueva Localización';
            limpiarModal();
            await cargarPadres();
            modal().show();
            if (window.feather) feather.replace();
        });

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
                modal().hide();
                todasLasLocs = [];
                mostrarToast(id ? 'Localización actualizada.' : 'Localización creada.', 'success');
                cargar(paginaActual);
            } catch (err) {
                mostrarToast(err.message ?? 'No se pudo guardar.', 'danger');
            } finally {
                document.getElementById('loc-btn-texto').classList.remove('d-none');
                document.getElementById('loc-btn-loading').classList.add('d-none');
                document.getElementById('btn-guardar-loc').disabled = false;
            }
        });

        function delegarClicks(contenedor) {
            contenedor.addEventListener('click', async e => {
                const editar = e.target.closest('.btn-editar');
                const eliminar = e.target.closest('.btn-eliminar');
                if (editar) {
                    document.getElementById('modal-loc-titulo').textContent = 'Editar Localización';
                    document.getElementById('loc-id').value = editar.dataset.id;
                    document.getElementById('loc-nombre').value = editar.dataset.nombre;
                    document.getElementById('loc-codigo').value = editar.dataset.codigo;
                    document.getElementById('loc-nivel').value = editar.dataset.nivel;
                    document.getElementById('form-loc').classList.remove('was-validated');
                    await cargarPadres(editar.dataset.id);
                    document.getElementById('loc-padre').value = editar.dataset.padre ?? '';
                    modal().show();
                    if (window.feather) feather.replace();
                }
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
                await http.delete('/locations/' + idEliminar);
                bootstrap.Modal.getInstance(document.getElementById('modal-eliminar')).hide();
                todasLasLocs = [];
                mostrarToast('Localización eliminada.', 'success');
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
            document.getElementById('filtro-nivel').value = '';
            cargar(1);
        });
        document.getElementById('btn-reintentar').addEventListener('click', () => cargar(paginaActual));

        if (window.feather) feather.replace();
        cargar(1);
    },

    onDestroy() {}
});
