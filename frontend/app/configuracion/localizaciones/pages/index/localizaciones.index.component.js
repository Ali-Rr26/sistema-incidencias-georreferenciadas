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

        // Tree state
        let treeRoots = null;   // top-level nodes (provinces) after loading tree
        let expandedIds = new Set();
        let modoArbol = true;   // false when a search/level filter is active

        const modal = () => bootstrap.Modal.getOrCreateInstance(document.getElementById('modal-loc-form'));
        const tbody  = () => document.getElementById('tabla-body');
        const thead  = () => document.getElementById('thead-locs');

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

        // ─── Tree mode ────────────────────────────────────────────────────────

        function getProvinces(rawTree) {
            // Root nodes in Ecuador are country-level; skip them and start from provinces.
            const result = [];
            for (const node of rawTree) {
                if (node.level === 'country') {
                    result.push(...(node.children || []));
                } else {
                    result.push(node);
                }
            }
            return result;
        }

        function buildFlatList(nodes, depth, result) {
            for (const node of nodes) {
                result.push({ ...node, _depth: depth });
                if (expandedIds.has(node.id) && node.children?.length) {
                    buildFlatList(node.children, depth + 1, result);
                }
            }
            return result;
        }

        function removeDescendants(nodeId, nodes) {
            for (const node of nodes) {
                if (node.id === nodeId) {
                    const purge = (children) => {
                        for (const c of children) {
                            expandedIds.delete(c.id);
                            if (c.children?.length) purge(c.children);
                        }
                    };
                    purge(node.children || []);
                    return;
                }
                if (node.children?.length) removeDescendants(nodeId, node.children);
            }
        }

        function renderArbol() {
            thead().innerHTML = `
                <tr>
                    <th>Nombre</th>
                    <th>Código</th>
                    <th>Nivel</th>
                    <th class="text-center">Acciones</th>
                </tr>`;

            const flat = buildFlatList(treeRoots, 0, []);

            tbody().innerHTML = flat.map(loc => {
                const hasChildren = loc.children?.length > 0;
                const isExpanded  = expandedIds.has(loc.id);
                const indent      = loc._depth * 24;
                return `
                <tr>
                    <td style="padding-left:${10 + indent}px">
                        ${hasChildren
                            ? `<button class="btn btn-link btn-sm p-0 me-1 btn-toggle text-muted" data-id="${loc.id}">
                                   <i data-feather="${isExpanded ? 'chevron-down' : 'chevron-right'}" class="feather-icon"></i>
                               </button>`
                            : `<span style="display:inline-block;width:20px;margin-right:4px"></span>`}
                        ${loc.name}
                    </td>
                    <td><code class="small">${loc.code ?? '—'}</code></td>
                    <td>${nivelBadge(loc.level)}</td>
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
                </tr>`;
            }).join('');

            document.getElementById('contenedor-cards').innerHTML = flat.map(loc => `
                <div class="card mb-2 shadow-sm" style="margin-left:${loc._depth * 16}px">
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <h6 class="mb-0">${loc.name} <code class="small">${loc.code ?? ''}</code></h6>
                                <div class="mt-1">${nivelBadge(loc.level)}</div>
                            </div>
                            <div class="d-flex gap-1">
                                ${loc.children?.length
                                    ? `<button class="btn btn-sm btn-outline-primary btn-toggle" data-id="${loc.id}">
                                           <i data-feather="${expandedIds.has(loc.id) ? 'chevron-up' : 'chevron-down'}" class="feather-icon"></i>
                                       </button>`
                                    : ''}
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

            document.getElementById('info-resultados').textContent = `${flat.length} localización${flat.length !== 1 ? 'es' : ''} visible${flat.length !== 1 ? 's' : ''}`;
            document.getElementById('paginacion').innerHTML = '';
            mostrarEstado('tabla');
            if (window.feather) feather.replace();
        }

        async function cargarArbol() {
            mostrarEstado('cargando');
            try {
                if (!treeRoots) {
                    const resp = await http.get('/locations/tree');
                    treeRoots = getProvinces(resp.data ?? resp);
                }
                if (!treeRoots.length) { mostrarEstado('vacio'); return; }
                renderArbol();
            } catch {
                mostrarEstado('error');
            }
        }

        // ─── Flat / search mode ───────────────────────────────────────────────

        function renderTablaFlat(datos, total) {
            if (!datos?.length) { mostrarEstado('vacio'); return; }

            thead().innerHTML = `
                <tr>
                    <th>#</th>
                    <th>Nombre</th>
                    <th>Código</th>
                    <th>Nivel</th>
                    <th>Padre</th>
                    <th class="text-center">Acciones</th>
                </tr>`;

            tbody().innerHTML = datos.map(loc => `
                <tr>
                    <td class="text-muted small">${loc.id}</td>
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
            renderPaginacion(document.getElementById('paginacion'), paginaActual, totalPaginas, buscar);
            mostrarEstado('tabla');
            if (window.feather) feather.replace();
        }

        async function buscar(pagina = 1) {
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
                renderTablaFlat(datos, total);
            } catch {
                mostrarEstado('error');
            }
        }

        // ─── Smart load: tree vs flat ──────────────────────────────────────────

        function cargar() {
            const search = document.getElementById('filtro-buscar').value.trim();
            const level  = document.getElementById('filtro-nivel').value;
            modoArbol = !search && !level;
            if (modoArbol) {
                cargarArbol();
            } else {
                buscar(1);
            }
        }

        // ─── Modal helpers ─────────────────────────────────────────────────────

        async function cargarPadres(excluirId = null) {
            if (!todasLasLocs.length) {
                const resp = await http.get('/locations?per_page=500');
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

        // ─── Events ───────────────────────────────────────────────────────────

        // Expand/collapse toggle (delegated on tbody — fires before edit/delete)
        function delegarClicks(contenedor) {
            contenedor.addEventListener('click', async e => {
                const toggle  = e.target.closest('.btn-toggle');
                const editar  = e.target.closest('.btn-editar');
                const eliminar = e.target.closest('.btn-eliminar');

                if (toggle && modoArbol) {
                    const id = parseInt(toggle.dataset.id);
                    if (expandedIds.has(id)) {
                        removeDescendants(id, treeRoots);
                        expandedIds.delete(id);
                    } else {
                        expandedIds.add(id);
                    }
                    renderArbol();
                    return;
                }

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
                name:      document.getElementById('loc-nombre').value.trim(),
                code:      document.getElementById('loc-codigo').value.trim(),
                level:     document.getElementById('loc-nivel').value,
                parent_id: padreVal ? parseInt(padreVal) : null,
            };

            document.getElementById('loc-btn-texto').classList.add('d-none');
            document.getElementById('loc-btn-loading').classList.remove('d-none');
            document.getElementById('btn-guardar-loc').disabled = true;

            try {
                id ? await http.put('/locations/' + id, payload)
                   : await http.post('/locations', payload);
                modal().hide();
                todasLasLocs = [];
                treeRoots = null; // invalidate tree cache
                mostrarToast(id ? 'Localización actualizada.' : 'Localización creada.', 'success');
                cargar();
            } catch (err) {
                mostrarToast(err.message ?? 'No se pudo guardar.', 'danger');
            } finally {
                document.getElementById('loc-btn-texto').classList.remove('d-none');
                document.getElementById('loc-btn-loading').classList.add('d-none');
                document.getElementById('btn-guardar-loc').disabled = false;
            }
        });

        document.getElementById('btn-confirmar-eliminar').addEventListener('click', async function () {
            if (!idEliminar) return;
            document.getElementById('eliminar-texto').classList.add('d-none');
            document.getElementById('eliminar-loading').classList.remove('d-none');
            this.disabled = true;
            try {
                await http.delete('/locations/' + idEliminar);
                bootstrap.Modal.getInstance(document.getElementById('modal-eliminar')).hide();
                todasLasLocs = [];
                treeRoots = null;
                mostrarToast('Localización eliminada.', 'success');
                cargar();
            } catch {
                mostrarToast('No se pudo eliminar.', 'danger');
            } finally {
                document.getElementById('eliminar-texto').classList.remove('d-none');
                document.getElementById('eliminar-loading').classList.add('d-none');
                document.getElementById('btn-confirmar-eliminar').disabled = false;
            }
        });

        document.getElementById('btn-filtrar').addEventListener('click', cargar);
        document.getElementById('filtro-buscar').addEventListener('keydown', e => { if (e.key === 'Enter') cargar(); });
        document.getElementById('btn-limpiar').addEventListener('click', () => {
            document.getElementById('filtro-buscar').value = '';
            document.getElementById('filtro-nivel').value = '';
            cargar();
        });
        document.getElementById('btn-reintentar').addEventListener('click', cargar);

        if (window.feather) feather.replace();
        cargar();
    },

    onDestroy() {}
});
