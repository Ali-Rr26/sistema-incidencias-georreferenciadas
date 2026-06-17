// Lógica de la lista de incidencias: tabla, filtros, paginación, eliminar

const POR_PAGINA = 10;
let paginaActual = 1;
let totalPaginas = 1;
let idEliminar = null;

// ── Helpers de badge ──────────────────────────────────────────────────────────
function badgePrioridad(p) {
    const map = { alta: "danger", media: "warning", baja: "success" };
    const label = p ? p.charAt(0).toUpperCase() + p.slice(1) : "—";
    return `<span class="badge bg-${map[p] || "secondary"}">${label}</span>`;
}

function badgeEstado(e) {
    const map = {
        pendiente:  { color: "secondary", label: "Pendiente" },
        en_proceso: { color: "primary",   label: "En proceso" },
        resuelto:   { color: "success",   label: "Resuelto" }
    };
    const cfg = map[e] || { color: "secondary", label: e || "—" };
    return `<span class="badge bg-${cfg.color}">${cfg.label}</span>`;
}

function formatearFecha(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ── Estados de la tabla ───────────────────────────────────────────────────────
function mostrarEstado(cual) {
    ["cargando", "vacio", "error", "tabla"].forEach(function (s) {
        const el = document.getElementById(s === "tabla" ? "contenedor-tabla" : "estado-" + s);
        if (el) el.classList.toggle("d-none", s !== cual);
    });
    feather.replace();
}

// ── Cargar incidencias ────────────────────────────────────────────────────────
function cargarIncidencias(pagina) {
    paginaActual = pagina || 1;
    mostrarEstado("cargando");

    const params = new URLSearchParams({
        page:      paginaActual,
        per_page:  POR_PAGINA,
        buscar:    document.getElementById("filtro-buscar").value.trim(),
        prioridad: document.getElementById("filtro-prioridad").value,
        tipo:      document.getElementById("filtro-tipo").value,
        estado:    document.getElementById("filtro-estado").value
    });

    fetch("http://localhost:8000/api/incidencias?" + params.toString(), {
        headers: { "Accept": "application/json" }
    })
        .then(function (res) {
            if (!res.ok) throw new Error("Error " + res.status);
            return res.json();
        })
        .then(function (resp) {
            const datos = resp.data || resp;
            const total = resp.total || datos.length;
            totalPaginas = Math.ceil(total / POR_PAGINA) || 1;
            renderTabla(datos, total);
        })
        .catch(function (err) {
            console.error("Error al cargar incidencias:", err);
            mostrarEstado("error");
        });
}

// ── Renderizar tabla + cards ──────────────────────────────────────────────────
function renderTabla(datos, total) {
    if (!datos || datos.length === 0) {
        mostrarEstado("vacio");
        return;
    }

    // — Filas de tabla (desktop) —
    const tbody = document.getElementById("tabla-body");
    tbody.innerHTML = datos.map(function (inc) {
        return `
            <tr>
                <td class="ps-3 text-muted small">${inc.id}</td>
                <td>
                    <span class="fw-semibold">${inc.titulo || "—"}</span>
                    ${inc.descripcion
                        ? `<br><small class="text-muted">${inc.descripcion.substring(0, 60)}${inc.descripcion.length > 60 ? "…" : ""}</small>`
                        : ""}
                </td>
                <td>${badgePrioridad(inc.prioridad)}</td>
                <td>
                    <span class="small">${inc.tipo || "—"}</span>
                    ${inc.subtipo ? `<br><small class="text-muted">${inc.subtipo}</small>` : ""}
                </td>
                <td>${badgeEstado(inc.estado)}</td>
                <td class="small text-muted">${formatearFecha(inc.created_at)}</td>
                <td class="text-center">
                    <div class="d-flex justify-content-center gap-1">
                        <a href="incidencias-detalle.html?id=${inc.id}"
                            class="btn btn-sm btn-outline-primary" title="Ver detalle">
                            <i data-feather="eye" class="feather-icon"></i>
                        </a>
                        <button type="button" class="btn btn-sm btn-outline-danger btn-eliminar"
                            data-id="${inc.id}" data-titulo="${inc.titulo}" title="Eliminar">
                            <i data-feather="trash-2" class="feather-icon"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
    }).join("");

    // — Cards (móvil) —
    const cards = document.getElementById("contenedor-cards");
    cards.innerHTML = datos.map(function (inc) {
        const titulo = inc.titulo || "—";
        const desc   = inc.descripcion
            ? inc.descripcion.substring(0, 80) + (inc.descripcion.length > 80 ? "…" : "")
            : "";
        return `
            <div class="card mb-2 shadow-sm">
                <div class="card-body p-3">
                    <div class="d-flex justify-content-between align-items-start mb-1">
                        <h6 class="card-title mb-0 me-2" style="font-size:.9rem;">${titulo}</h6>
                        ${badgePrioridad(inc.prioridad)}
                    </div>
                    ${desc ? `<p class="text-muted mb-2" style="font-size:.8rem;">${desc}</p>` : ""}
                    <div class="d-flex flex-wrap gap-2 mb-2">
                        <span class="badge bg-light text-dark border" style="font-size:.75rem;">
                            <i data-feather="tag" class="feather-icon" style="width:11px;height:11px;"></i>
                            ${inc.tipo || "—"}${inc.subtipo ? " / " + inc.subtipo : ""}
                        </span>
                        ${badgeEstado(inc.estado)}
                    </div>
                    <div class="d-flex justify-content-between align-items-center">
                        <small class="text-muted">
                            <i data-feather="calendar" class="feather-icon" style="width:12px;height:12px;"></i>
                            ${formatearFecha(inc.created_at)}
                        </small>
                        <div class="d-flex gap-1">
                            <a href="incidencias-detalle.html?id=${inc.id}"
                                class="btn btn-sm btn-outline-primary" title="Ver detalle">
                                <i data-feather="eye" class="feather-icon"></i>
                            </a>
                            <button type="button" class="btn btn-sm btn-outline-danger btn-eliminar"
                                data-id="${inc.id}" data-titulo="${titulo}" title="Eliminar">
                                <i data-feather="trash-2" class="feather-icon"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;
    }).join("");

    const desde = (paginaActual - 1) * POR_PAGINA + 1;
    const hasta = Math.min(paginaActual * POR_PAGINA, total);
    document.getElementById("info-resultados").textContent =
        `Mostrando ${desde}–${hasta} de ${total} incidencias`;

    renderPaginacion();
    mostrarEstado("tabla");
    feather.replace();
}

// ── Paginación ────────────────────────────────────────────────────────────────
function renderPaginacion() {
    const ul = document.getElementById("paginacion");
    ul.innerHTML = "";
    if (totalPaginas <= 1) return;

    function crearLi(label, pagina, deshabilitado, activo) {
        const li = document.createElement("li");
        li.className = "page-item" + (deshabilitado ? " disabled" : "") + (activo ? " active" : "");
        li.innerHTML = `<a class="page-link" href="#">${label}</a>`;
        if (!deshabilitado && !activo) {
            li.querySelector("a").addEventListener("click", function (e) {
                e.preventDefault();
                cargarIncidencias(pagina);
            });
        }
        return li;
    }

    ul.appendChild(crearLi("&laquo;", paginaActual - 1, paginaActual === 1, false));
    for (let i = 1; i <= totalPaginas; i++) {
        ul.appendChild(crearLi(i, i, false, i === paginaActual));
    }
    ul.appendChild(crearLi("&raquo;", paginaActual + 1, paginaActual === totalPaginas, false));
}

// ── Eliminar (tabla y cards comparten el mismo handler) ───────────────────────
function abrirModalEliminar(e) {
    const btn = e.target.closest(".btn-eliminar");
    if (!btn) return;
    idEliminar = btn.dataset.id;
    document.getElementById("modal-eliminar-titulo").textContent = btn.dataset.titulo;
    new bootstrap.Modal(document.getElementById("modal-eliminar")).show();
    feather.replace();
}

document.getElementById("tabla-body").addEventListener("click", abrirModalEliminar);
document.getElementById("contenedor-cards").addEventListener("click", abrirModalEliminar);

document.getElementById("btn-confirmar-eliminar").addEventListener("click", function () {
    if (!idEliminar) return;
    document.getElementById("eliminar-texto").classList.add("d-none");
    document.getElementById("eliminar-loading").classList.remove("d-none");
    this.disabled = true;

    fetch("http://localhost:8000/api/incidencias/" + idEliminar, {
        method: "DELETE",
        headers: { "Accept": "application/json" }
    })
        .then(function (res) {
            if (!res.ok) throw new Error("Error " + res.status);
            bootstrap.Modal.getInstance(document.getElementById("modal-eliminar")).hide();
            mostrarToast("Incidencia eliminada correctamente.", "success");
            cargarIncidencias(paginaActual);
        })
        .catch(function (err) {
            console.error("Error al eliminar:", err);
            mostrarToast("No se pudo eliminar la incidencia.", "danger");
        })
        .finally(function () {
            document.getElementById("eliminar-texto").classList.remove("d-none");
            document.getElementById("eliminar-loading").classList.add("d-none");
            document.getElementById("btn-confirmar-eliminar").disabled = false;
        });
});

// ── Filtros ───────────────────────────────────────────────────────────────────
document.getElementById("btn-filtrar").addEventListener("click", function () {
    cargarIncidencias(1);
});

document.getElementById("filtro-buscar").addEventListener("keydown", function (e) {
    if (e.key === "Enter") cargarIncidencias(1);
});

document.getElementById("btn-limpiar").addEventListener("click", function () {
    document.getElementById("filtro-buscar").value = "";
    document.getElementById("filtro-prioridad").value = "";
    document.getElementById("filtro-tipo").value = "";
    document.getElementById("filtro-estado").value = "";
    cargarIncidencias(1);
});

document.getElementById("btn-reintentar").addEventListener("click", function () {
    cargarIncidencias(paginaActual);
});

// ── Toast ─────────────────────────────────────────────────────────────────────
function mostrarToast(mensaje, tipo) {
    const el = document.getElementById("toast-msg");
    el.className = "toast align-items-center text-white border-0 bg-" + tipo;
    document.getElementById("toast-msg-texto").textContent = mensaje;
    new bootstrap.Toast(el, { delay: 3000 }).show();
}

// ── Carga inicial ─────────────────────────────────────────────────────────────
cargarIncidencias(1);
