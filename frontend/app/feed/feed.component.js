import { defineComponent } from '../utils/component.js';
import { API_URL } from '../core/config.js';

const POR_PAGINA = 12;
const STATUS_LABEL = { pending: 'Pendiente', in_progress: 'En proceso', resolved: 'Resuelto' };
const CAT_EMOJI = ['🔧', '🔒', '🌿', '💧', '🚨', '🏗️', '⚡', '📍'];

let paginaActual = 1;
let totalPaginas = 1;
let filtroStatus = '';
let cargando = false;
let incidencias = [];

export default defineComponent({
    templateUrl: 'app/feed/feed.component.html',
    styleUrl: 'app/feed/feed.component.css',

    async onInit() {
        document.body.classList.add('feed-view');

        const grid = document.getElementById('feed-grid');
        const skeleton = document.getElementById('feed-cargando');
        const vacio = document.getElementById('feed-vacio');
        const cargarMasEl = document.getElementById('feed-cargar-mas');
        const btnCargarMas = document.getElementById('btn-cargar-mas');

        function priorityClass(p) {
            return { high: 'priority-high', medium: 'priority-medium', low: 'priority-low' }[p] ?? 'priority-low';
        }

        function statusClass(s) {
            return `status-${s}`;
        }

        function catEmoji(id) {
            return CAT_EMOJI[(id ?? 0) % CAT_EMOJI.length];
        }

        function renderCard(inc) {
            const orgName = inc.category?.organization?.name ?? inc.category?.name ?? '—';
            const catName = inc.category?.name ?? '—';
            const locName = inc.location?.name ?? '—';
            const statusLabel = STATUS_LABEL[inc.status] ?? inc.status;
            const emoji = catEmoji(inc.incident_category_id);
            const fecha = inc.created_at
                ? new Date(inc.created_at).toLocaleDateString('es-EC', { day: '2-digit', month: 'short' })
                : '';

            return `
                <div class="feed-card ${priorityClass(inc.priority)}">
                    <div class="feed-card-thumb">
                        <div class="feed-card-thumb-icon">${emoji}</div>
                        <span class="feed-card-status ${statusClass(inc.status)}">${statusLabel}</span>
                    </div>
                    <div class="feed-card-body">
                        <div class="feed-card-cat">${catName}</div>
                        <div class="feed-card-org">${orgName}</div>
                        <div class="feed-card-loc">
                            <div class="feed-priority-dot"></div>
                            ${locName} · ${fecha}
                        </div>
                    </div>
                </div>`;
        }

        async function fetchIncidencias(pagina, append = false) {
            if (cargando) return;
            cargando = true;

            if (!append) {
                skeleton.classList.remove('d-none');
                grid.classList.add('d-none');
                vacio.classList.add('d-none');
                cargarMasEl.style.display = 'none';
                incidencias = [];
            }

            const params = new URLSearchParams({ page: pagina, per_page: POR_PAGINA });
            if (filtroStatus) params.set('status', filtroStatus);

            try {
                const resp = await fetch(`${API_URL}/incidents/feed?${params.toString()}`);
                const json = await resp.json();

                const datos = json.data ?? [];
                const meta = json.meta ?? {};
                paginaActual = meta.current_page ?? pagina;
                totalPaginas = meta.last_page ?? 1;

                if (!append) incidencias = datos;
                else incidencias = [...incidencias, ...datos];

                skeleton.classList.add('d-none');

                if (incidencias.length === 0) {
                    grid.classList.add('d-none');
                    vacio.classList.remove('d-none');
                    cargarMasEl.style.display = 'none';
                } else {
                    vacio.classList.add('d-none');
                    if (append) {
                        grid.insertAdjacentHTML('beforeend', datos.map(renderCard).join(''));
                    } else {
                        grid.innerHTML = incidencias.map(renderCard).join('');
                        grid.classList.remove('d-none');
                    }
                    cargarMasEl.style.display = paginaActual < totalPaginas ? 'flex' : 'none';
                    btnCargarMas.disabled = false;
                    btnCargarMas.textContent = 'Cargar más';
                }
            } catch {
                skeleton.classList.add('d-none');
                vacio.classList.remove('d-none');
                vacio.querySelector('p').textContent = 'Error al cargar. Intente de nuevo.';
            } finally {
                cargando = false;
            }
        }

        // Filter chips
        document.getElementById('feed-filters').addEventListener('click', e => {
            const chip = e.target.closest('.feed-filter-chip');
            if (!chip) return;
            document.querySelectorAll('.feed-filter-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            filtroStatus = chip.dataset.status;
            paginaActual = 1;
            fetchIncidencias(1, false);
        });

        // Load more
        btnCargarMas.addEventListener('click', () => {
            btnCargarMas.disabled = true;
            btnCargarMas.textContent = 'Cargando...';
            fetchIncidencias(paginaActual + 1, true);
        });

        fetchIncidencias(1, false);
    },

    onDestroy() {
        document.body.classList.remove('feed-view');
    }
});
