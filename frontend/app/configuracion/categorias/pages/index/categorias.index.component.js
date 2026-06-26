import { defineComponent } from '../../../../utils/component.js';
import { http } from '../../../../core/http.service.js';
import { router } from '../../../../core/router.js';
import { renderPaginacion } from '../../../../shared/pagination/pagination.js';
import { initSelect, clearSelect, getSelect, destroyAll } from '../../../../shared/select-search.js';

const POR_PAGINA = 15;

export default defineComponent({
    templateUrl: 'app/configuracion/categorias/pages/index/categorias.index.component.html',

    async onInit() {
        let paginaActual = 1;
        let totalPaginas = 1;
        let idEliminar = null;

        // Tree state
        let treeRoots = null;
        let expandedIds = new Set();
        let modoArbol = true;

        const tbody  = () => document.getElementById('tabla-body');
        const thead  = () => document.getElementById('thead-cats');

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

        function orgNames(cat) {
            if (!cat.organizations?.length) return '—';
            return cat.organizations.map(o => o.name).join(', ');
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
                    <th class="text-center">Acciones</th>
                </tr>`;

            const flat = buildFlatList(treeRoots, 0, []);

            tbody().innerHTML = flat.map(cat => {
                const hasChildren = cat.children?.length > 0;
                const isExpanded  = expandedIds.has(cat.id);
                const indent      = cat._depth * 24;
                const firstOrgId  = cat.organizations?.[0]?.id ?? '';
                return `
                <tr>
                    <td style="padding-left:${10 + indent}px">
                        ${hasChildren
                            ? `<button class="btn btn-link btn-sm p-0 me-1 btn-toggle text-muted" data-id="${cat.id}">
                                   <i class="fas ${isExpanded ? 'fa-chevron-down' : 'fa-chevron-right'}"></i>
                               </button>`
                            : `<span style="display:inline-block;width:20px;margin-right:4px"></span>`}
                        ${cat.name}
                    </td>
                    <td class="text-center">
                        <div class="d-flex justify-content-center gap-1">
                            <button class="btn btn-sm btn-outline-secondary btn-editar"
                                data-id="${cat.id}" data-nombre="${cat.name}"
                                data-org="${firstOrgId}" data-padre="${cat.parent_id ?? ''}">
                                <i class="fas fa-pencil-alt"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger btn-eliminar"
                                data-id="${cat.id}" data-nombre="${cat.name}">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
            }).join('');

            document.getElementById('contenedor-cards').innerHTML = flat.map(cat => {
                const firstOrgId = cat.organizations?.[0]?.id ?? '';
                return `
                <div class="card mb-2 shadow-sm" style="margin-left:${cat._depth * 16}px">
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <h6 class="mb-0">${cat.name}</h6>
                            </div>
                            <div class="d-flex gap-1">
                                ${cat.children?.length
                                    ? `<button class="btn btn-sm btn-outline-primary btn-toggle" data-id="${cat.id}">
                                           <i class="fas ${expandedIds.has(cat.id) ? 'fa-chevron-up' : 'fa-chevron-down'}"></i>
                                       </button>`
                                    : ''}
                                <button class="btn btn-sm btn-outline-secondary btn-editar"
                                    data-id="${cat.id}" data-nombre="${cat.name}"
                                    data-org="${firstOrgId}" data-padre="${cat.parent_id ?? ''}">
                                    <i class="fas fa-pencil-alt"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger btn-eliminar"
                                    data-id="${cat.id}" data-nombre="${cat.name}">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>`;
            }).join('');

            document.getElementById('info-resultados').textContent = `${flat.length} categoría${flat.length !== 1 ? 's' : ''} visible${flat.length !== 1 ? 's' : ''}`;
            document.getElementById('paginacion').innerHTML = '';
            mostrarEstado('tabla');
        }

        async function cargarArbol() {
            mostrarEstado('cargando');
            try {
                if (!treeRoots) {
                    const resp = await http.get('/incident-categories/tree');
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
                    <th>Organizaciones</th>
                    <th>Categoría padre</th>
                    <th class="text-center">Acciones</th>
                </tr>`;

            tbody().innerHTML = datos.map(cat => {
                const firstOrgId = cat.organizations?.[0]?.id ?? '';
                return `
                <tr>
                    <td class="ps-3 text-muted small">${cat.id}</td>
                    <td class="fw-semibold">${cat.name}</td>
                    <td class="text-muted small">${orgNames(cat)}</td>
                    <td class="text-muted small">${cat.parent?.name ?? '—'}</td>
                    <td class="text-center">
                        <div class="d-flex justify-content-center gap-1">
                            <button class="btn btn-sm btn-outline-secondary btn-editar"
                                data-id="${cat.id}" data-nombre="${cat.name}"
                                data-org="${firstOrgId}" data-padre="${cat.parent_id ?? ''}">
                                <i class="fas fa-pencil-alt"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger btn-eliminar"
                                data-id="${cat.id}" data-nombre="${cat.name}">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
            }).join('');

            document.getElementById('contenedor-cards').innerHTML = datos.map(cat => {
                const firstOrgId = cat.organizations?.[0]?.id ?? '';
                return `
                <div class="card mb-2 shadow-sm">
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <h6 class="mb-0">${cat.name}</h6>
                                <small class="text-muted">${orgNames(cat)}</small>
                                ${cat.parent ? `<br><small class="text-muted">Padre: ${cat.parent.name}</small>` : ''}
                            </div>
                            <div class="d-flex gap-1">
                                <button class="btn btn-sm btn-outline-secondary btn-editar"
                                    data-id="${cat.id}" data-nombre="${cat.name}"
                                    data-org="${firstOrgId}" data-padre="${cat.parent_id ?? ''}">
                                    <i class="fas fa-pencil-alt"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger btn-eliminar"
                                    data-id="${cat.id}" data-nombre="${cat.name}">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>`;
            }).join('');

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
                parent_id: document.getElementById('filtro-padre').value,
            });
            try {
                const resp = await http.get('/incident-categories?' + params.toString());
                const datos = resp.data ?? resp;
                const total = resp.meta?.total ?? resp.total ?? datos.length;
                totalPaginas = Math.ceil(total / POR_PAGINA) || 1;
                renderTabla(datos, total);
            } catch {
                mostrarEstado('error');
            }
        }

        async function cargarCategoriasPadre() {
            const resp = await http.get('/incident-categories?per_page=200');
            const cats = resp.data ?? resp;
            const sel = document.getElementById('filtro-padre');
            sel.innerHTML = '<option value="">Todas las categorías</option>';
            cats.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.name;
                sel.appendChild(opt);
            });
        }

        // ─── Smart load: tree vs flat ──────────────────────────────────────────

        function cargar() {
            const search = document.getElementById('filtro-buscar').value.trim();
            const parent = document.getElementById('filtro-padre').value;
            modoArbol = !search && !parent;
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
                    router.navigate('/categorias/crear?id=' + editar.dataset.id);
                    return;
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
                await http.delete('/incident-categories/' + idEliminar);
                bootstrap.Modal.getInstance(document.getElementById('modal-eliminar')).hide();
                treeRoots = null;
                mostrarToast('Categoría eliminada.', 'success');
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
            clearSelect('filtro-padre');
            cargar();
        });
        document.getElementById('btn-reintentar').addEventListener('click', cargar);


        // ─── Tom Select en filtros ─────────────────────────────────────────
        await cargarCategoriasPadre().catch(() => {});
        initSelect('filtro-padre', { placeholder: 'Buscar categoría padre...' });

        cargar();
    },

    onDestroy() { destroyAll(); }
});
