/**
 * Renders Bootstrap 5 pagination into a given <ul> element.
 * @param {HTMLElement} ulElement
 * @param {number} paginaActual
 * @param {number} totalPaginas
 * @param {function} onPageChange - called with the new page number
 */
export function renderPaginacion(ulElement, paginaActual, totalPaginas, onPageChange) {
    ulElement.innerHTML = '';
    if (totalPaginas <= 1) return;

    function crearLi(label, pagina, deshabilitado, activo) {
        const li = document.createElement('li');
        li.className = 'page-item' + (deshabilitado ? ' disabled' : '') + (activo ? ' active' : '');
        li.innerHTML = `<a class="page-link" href="#">${label}</a>`;
        if (!deshabilitado && !activo) {
            li.querySelector('a').addEventListener('click', e => {
                e.preventDefault();
                onPageChange(pagina);
            });
        }
        return li;
    }

    ulElement.appendChild(crearLi('&laquo;', paginaActual - 1, paginaActual === 1, false));
    for (let i = 1; i <= totalPaginas; i++) {
        ulElement.appendChild(crearLi(i, i, false, i === paginaActual));
    }
    ulElement.appendChild(crearLi('&raquo;', paginaActual + 1, paginaActual === totalPaginas, false));
}
