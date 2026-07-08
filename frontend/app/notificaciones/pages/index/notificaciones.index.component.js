import { notificationService } from '../../../shared/notification.service.js';
import { renderPaginacion } from '../../../shared/pagination/pagination.js';

const POR_PAGINA = 15;

/**
 * Crea un <i> FontAwesome.
 */
function faIcon(cls) {
  const i = document.createElement('i');
  i.className = cls;
  return i;
}

/**
 * Devuelve el icono correspondiente al tipo de notificación.
 */
function iconForType(type) {
  switch (type) {
    case 'claim':
      return 'fa-solid fa-hand-pointer';
    case 'assignment':
      return 'fa-solid fa-user-check';
    case 'status_change':
      return 'fa-solid fa-circle-check';
    case 'comment':
      return 'fa-solid fa-comment';
    default:
      return 'fa-solid fa-bell';
  }
}

/**
 * Construye el <li> de una notificación.
 */
function buildNotificationLi(notif) {
  const li = document.createElement('li');
  li.className = `list-group-item d-flex gap-3 align-items-start ${notif.read ? '' : 'fw-semibold bg-light'}`;
  li.dataset.id = String(notif.id);

  const icon = faIcon(iconForType(notif.type));
  icon.classList.add('mt-1', 'text-primary');
  li.appendChild(icon);

  const body = document.createElement('div');
  body.className = 'flex-grow-1';

  const msg = document.createElement('div');
  msg.textContent = notif.message ?? '';
  body.appendChild(msg);

  const meta = document.createElement('small');
  meta.className = 'text-muted';
  meta.textContent = notif.created_at
    ? new Date(notif.created_at).toLocaleString('es-EC', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
  body.appendChild(meta);

  li.appendChild(body);

  if (notif.incident?.id) {
    const link = document.createElement('a');
    link.href = `#/incidencias/${notif.incident.id}`;
    link.className = 'btn btn-sm btn-outline-secondary';
    link.title = 'Ver incidencia';
    link.appendChild(faIcon('fa-solid fa-arrow-right'));
    li.appendChild(link);
  }

  if (!notif.read) {
    const dot = document.createElement('span');
    dot.className = 'badge bg-primary rounded-pill';
    dot.textContent = 'nuevo';
    li.appendChild(dot);
  }

  // Click anywhere on the row marks as read (if unread)
  if (!notif.read) {
    li.style.cursor = 'pointer';
    li.addEventListener('click', async (e) => {
      // Don't double-fire when clicking the "view" link
      if (e.target.closest('a')) return;
      await marcarLeida(notif.id, li);
    });
  }

  return li;
}

async function marcarLeida(id, li) {
  try {
    await notificationService.markRead(id);
    li.classList.add('read');
    li.classList.remove('fw-semibold', 'bg-light');
    li.style.cursor = 'default';
    // remove the listener
    const clone = li.cloneNode(true);
    li.parentNode.replaceChild(clone, li);
    updateUnreadCounter();
  } catch {
    // Silent fail
  }
}

function updateUnreadCounter() {
  const visibles = document.querySelectorAll(
    '.list-group-item.fw-semibold',
  ).length;
  document.getElementById('contador-unread').textContent = String(visibles);
  document.getElementById('btn-marcar-todas').disabled = visibles === 0;
}

export default {
  template: `
    <div class="container-fluid py-4">
      <div
        class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-2"
      >
        <div>
          <h2 class="mb-0">Notificaciones</h2>
          <small class="text-muted">
            <span id="contador-unread">0</span> sin leer
          </small>
        </div>
        <button id="btn-marcar-todas" class="btn btn-outline-primary" disabled>
          <i class="fa-solid fa-check-double me-1"></i> Marcar todas como leídas
        </button>
      </div>

      <div id="estado-cargando" class="text-center py-5">
        <div class="spinner-border text-primary" role="status"></div>
        <p class="text-muted mt-2 mb-0">Cargando notificaciones…</p>
      </div>

      <div id="estado-vacio" class="text-center py-5 d-none">
        <i class="fa-solid fa-bell-slash fa-3x text-muted mb-3"></i>
        <p class="text-muted mb-0">No tenés notificaciones.</p>
      </div>

      <div id="estado-error" class="alert alert-danger d-none" role="alert">
        <i class="fa-solid fa-triangle-exclamation me-2"></i>
        No se pudieron cargar las notificaciones.
        <button id="btn-reintentar" class="btn btn-sm btn-outline-danger ms-2">
          Reintentar
        </button>
      </div>

      <div id="contenedor-lista" class="card d-none">
        <ul id="lista-notificaciones" class="list-group list-group-flush"></ul>
        <div
          class="card-footer d-flex justify-content-between align-items-center flex-wrap gap-2"
        >
          <small id="info-resultados" class="text-muted"></small>
          <nav><ul id="paginacion" class="pagination pagination-sm mb-0"></ul></nav>
        </div>
      </div>
    </div>
  `,

  async onInit() {
    let paginaActual = 1;
    let totalPaginas = 1;

    function mostrarEstado(cual) {
      ['cargando', 'vacio', 'error', 'contenedor-lista'].forEach((s) => {
        const el = document.getElementById('estado-' + s);
        if (el) el.classList.toggle('d-none', s !== cual);
      });
    }

    function renderLista(items, total) {
      const ul = document.getElementById('lista-notificaciones');
      ul.replaceChildren(...items.map(buildNotificationLi));

      const desde = (paginaActual - 1) * POR_PAGINA + 1;
      const hasta = Math.min(paginaActual * POR_PAGINA, total);
      document.getElementById('info-resultados').textContent =
        `Mostrando ${desde}–${hasta} de ${total}`;

      renderPaginacion(
        document.getElementById('paginacion'),
        paginaActual,
        totalPaginas,
        cargar,
      );
      updateUnreadCounter();
      mostrarEstado('contenedor-lista');
    }

    async function cargar(pagina = 1) {
      paginaActual = pagina;
      mostrarEstado('cargando');
      try {
        const { data, meta, unreadCount } = await notificationService.list({
          page: paginaActual,
          perPage: POR_PAGINA,
        });
        const total = meta?.total ?? data.length;
        totalPaginas = Math.ceil(total / POR_PAGINA) || 1;
        document.getElementById('contador-unread').textContent =
          String(unreadCount);
        if (data.length === 0) {
          mostrarEstado('vacio');
          return;
        }
        renderLista(data, total);
      } catch {
        mostrarEstado('error');
      }
    }

    document
      .getElementById('btn-reintentar')
      .addEventListener('click', () => cargar(paginaActual));

    document
      .getElementById('btn-marcar-todas')
      .addEventListener('click', async () => {
        try {
          await notificationService.markAllRead();
          cargar(paginaActual);
        } catch {
          /* silent fail */
        }
      });

    cargar(1);
  },

  onDestroy() {},
};
