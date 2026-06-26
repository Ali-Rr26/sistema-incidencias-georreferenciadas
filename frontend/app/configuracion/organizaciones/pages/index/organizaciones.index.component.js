import { defineComponent } from '../../../../utils/component.js';
import { http } from '../../../../core/http.service.js';
import { renderPaginacion } from '../../../../shared/pagination/pagination.js';
import { router } from '../../../../core/router.js';

const POR_PAGINA = 15;

export default defineComponent({
    templateUrl: 'app/configuracion/organizaciones/pages/index/organizaciones.index.component.html',

    async onInit() {
        let paginaActual = 1;
        let totalPaginas = 1;
        let idEliminar = null;

        // Tree state
        let treeRoots = null;
        let expandedIds = new Set();
        let modoArbol = true;

        // Cascading location filter state
        let locationTree = null; // raw tree from API

        const tbody  = () => document.getElementById('tabla-body');
        const thead  = () => document.getElementById('thead-orgs');

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
        }

        function formatearFecha(iso) {
            if (!iso) return '—';
            return new Date(iso).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }

        // ─── Tree mode ────────────────────────────────────────────────────────

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
                    <th>Localización</th>
                    <th class="text-center">Acciones</th>
                </tr>`;

            const flat = buildFlatList(treeRoots, 0, []);

            tbody().innerHTML = flat.map(org => {
                const hasChildren = org.children?.length > 0;
                const isExpanded  = expandedIds.has(org.id);
                const indent      = org._depth * 24;
                return `
                <tr>
                    <td style="padding-left:${10 + indent}px">
                        ${hasChildren
                            ? `<button class="btn btn-link btn-sm p-0 me-1 btn-toggle text-muted" data-id="${org.id}">
                                    <i class="fas ${isExpanded ? 'fa-chevron-down' : 'fa-chevron-right'}"></i>
                               </button>`
                            : `<span style="display:inline-block;width:20px;margin-right:4px"></span>`}
                        ${org.name}
                    </td>
                    <td class="text-muted small">${org.location?.name ?? '—'}</td>
                    <td class="text-center">
                        <div class="d-flex justify-content-center gap-1">
                            <button class="btn btn-sm btn-outline-secondary btn-editar"
                                data-id="${org.id}">
                                <i class="fas fa-pencil-alt"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger btn-eliminar"
                                data-id="${org.id}" data-nombre="${org.name}">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
            }).join('');

            document.getElementById('contenedor-cards').innerHTML = flat.map(org => {
                return `
                <div class="card mb-2 shadow-sm" style="margin-left:${org._depth * 16}px">
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <h6 class="mb-0">${org.name}</h6>
                                <small class="text-muted">${org.location?.name ?? '—'}</small>
                            </div>
                            <div class="d-flex gap-1">
                                ${org.children?.length
                                    ? `<button class="btn btn-sm btn-outline-primary btn-toggle" data-id="${org.id}">
                                           <i class="fas ${expandedIds.has(org.id) ? 'fa-chevron-up' : 'fa-chevron-down'}"></i>
                                       </button>`
                                    : ''}
                                <button class="btn btn-sm btn-outline-secondary btn-editar"
                                    data-id="${org.id}">
                                    <i class="fas fa-pencil-alt"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger btn-eliminar"
                                    data-id="${org.id}" data-nombre="${org.name}">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>`;
            }).join('');

            document.getElementById('info-resultados').textContent = `${flat.length} organización${flat.length !== 1 ? 'es' : ''} visible${flat.length !== 1 ? 's' : ''}`;
            document.getElementById('paginacion').innerHTML = '';
            mostrarEstado('tabla');
        }

        async function cargarArbol() {
            mostrarEstado('cargando');
            try {
                if (!treeRoots) {
                    const resp = await http.get('/organizations/tree');
                    treeRoots = resp.data ?? resp;
                }
                if (!treeRoots.length) { mostrarEstado('vacio'); return; }
                renderArbol();
            } catch {
                mostrarEstado('error');
            }
        }

        // ─── Flat / search mode ───────────────────────────────────────────────

        function renderTabla(datos, total) {
            if (!datos || datos.length === 0) { mostrarEstado('vacio'); return; }

            thead().innerHTML = `
                <tr>
                    <th>#</th>
                    <th>Nombre</th>
                    <th>Localización</th>
                    <th>Org. padre</th>
                    <th>Creado</th>
                    <th class="text-center">Acciones</th>
                </tr>`;

            tbody().innerHTML = datos.map(org => `
                <tr>
                    <td class="ps-3 text-muted small">${org.id}</td>
                    <td class="fw-semibold">${org.name}</td>
                    <td class="text-muted small">${org.location?.name ?? '—'}</td>
                    <td class="text-muted small">${org.parent?.name ?? '—'}</td>
                    <td class="small text-muted">${formatearFecha(org.created_at)}</td>
                    <td class="text-center">
                        <div class="d-flex justify-content-center gap-1">
                            <button class="btn btn-sm btn-outline-secondary btn-editar"
                                data-id="${org.id}">
                                <i class="fas fa-pencil-alt"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger btn-eliminar"
                                data-id="${org.id}" data-nombre="${org.name}">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </td>
                </tr>`).join('');

            document.getElementById('contenedor-cards').innerHTML = datos.map(org => `
                <div class="card mb-2 shadow-sm">
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <h6 class="mb-0">${org.name}</h6>
                                <small class="text-muted">${org.location?.name ?? '—'}</small>
                                ${org.parent ? `<br><small class="text-muted">Padre: ${org.parent.name}</small>` : ''}
                            </div>
                            <div class="d-flex gap-1">
                                <button class="btn btn-sm btn-outline-secondary btn-editar"
                                    data-id="${org.id}">
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
            renderPaginacion(document.getElementById('paginacion'), paginaActual, totalPaginas, buscar);
            mostrarEstado('tabla');
        }

        async function buscar(pagina = 1) {
            paginaActual = pagina;
            mostrarEstado('cargando');
            const params = new URLSearchParams({
                page: paginaActual,
                per_page: POR_PAGINA,
                search: document.getElementById('filtro-buscar').value.trim(),
            });
            const locId = getLocationFilterValue();
            if (locId) params.set('location_id', locId);
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

        // ─── Cascading location filter ────────────────────────────────────────

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

        function flatChildren(nodes, result = []) {
            for (const n of nodes) {
                result.push(n);
                if (n.children?.length) flatChildren(n.children, result);
            }
            return result;
        }

        async function cargarArbolLocations() {
            if (locationTree) return;
            const resp = await http.get('/locations/tree');
            locationTree = resp.data ?? resp;
        }

        function poblarSelect(selId, items, textoDefault = '') {
            const sel = document.getElementById(selId);
            sel.innerHTML = `<option value="">${textoDefault}</option>`;
            items.forEach(item => {
                const opt = document.createElement('option');
                opt.value = item.id;
                opt.textContent = item.name;
                sel.appendChild(opt);
            });
            sel.disabled = items.length === 0;
        }

        function initCascadingFilters() {
            const paisSel     = document.getElementById('filtro-pais');
            const provinciaSel = document.getElementById('filtro-provincia');
            const ciudadSel   = document.getElementById('filtro-ciudad');

            // Cargar países desde el árbol
            if (locationTree?.length) {
                poblarSelect('filtro-pais', locationTree, 'País');
            }

            let cambiandoCadena = false;

            paisSel.addEventListener('change', () => {
                if (cambiandoCadena) return;
                cambiandoCadena = true;
                provinciaSel.value = '';
                ciudadSel.value = '';
                if (paisSel.value) {
                    const pais = findNodeById(locationTree, parseInt(paisSel.value));
                    poblarSelect('filtro-provincia', pais?.children ?? [], 'Provincia');
                    provinciaSel.disabled = false;
                } else {
                    poblarSelect('filtro-provincia', [], 'Provincia');
                    poblarSelect('filtro-ciudad', [], 'Ciudad');
                }
                cambiandoCadena = false;
                cargar();
            });

            provinciaSel.addEventListener('change', () => {
                if (cambiandoCadena) return;
                cambiandoCadena = true;
                const val = provinciaSel.value;
                ciudadSel.value = '';
                if (val) {
                    const pais = findNodeById(locationTree, parseInt(paisSel.value));
                    const provincia = pais?.children?.find(c => c.id === parseInt(val));
                    poblarSelect('filtro-ciudad', provincia?.children ?? [], 'Ciudad');
                    ciudadSel.disabled = false;
                } else {
                    poblarSelect('filtro-ciudad', [], 'Ciudad');
                }
                cambiandoCadena = false;
                cargar();
            });

            ciudadSel.addEventListener('change', () => {
                if (cambiandoCadena) return;
                cargar();
            });
        }

        function getLocationFilterValue() {
            return document.getElementById('filtro-ciudad').value
                || document.getElementById('filtro-provincia').value
                || document.getElementById('filtro-pais').value;
        }

        // ─── Smart load: tree vs flat ──────────────────────────────────────────

        function cargar() {
            const search = document.getElementById('filtro-buscar').value.trim();
            modoArbol = !search && !getLocationFilterValue();
            if (modoArbol) {
                cargarArbol();
            } else {
                buscar(1);
            }
        }

        // ─── Events ───────────────────────────────────────────────────────────

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
                    router.navigate('/organizaciones/crear?id=' + editar.dataset.id);
                }
                if (eliminar) {
                    idEliminar = eliminar.dataset.id;
                    document.getElementById('modal-eliminar-nombre').textContent = eliminar.dataset.nombre;
                    new bootstrap.Modal(document.getElementById('modal-eliminar')).show();
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
                treeRoots = null;
                mostrarToast('Organización eliminada.', 'success');
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
            document.getElementById('filtro-pais').value = '';
            document.getElementById('filtro-provincia').value = '';
            document.getElementById('filtro-ciudad').value = '';
            poblarSelect('filtro-provincia', [], 'Provincia');
            poblarSelect('filtro-ciudad', [], 'Ciudad');
            cargar();
        });
        document.getElementById('btn-reintentar').addEventListener('click', cargar);

        // Init cascading location filter
        try {
            await cargarArbolLocations();
            initCascadingFilters();
        } catch { /* non-critical */ }

        cargar();
    },

    onDestroy() {}
});
