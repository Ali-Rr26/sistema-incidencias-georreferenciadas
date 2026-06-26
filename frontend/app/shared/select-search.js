/**
 * Tom Select wrapper — searchable dropdowns for all selects.
 *
 * Uso:
 *   import { initSelect, updateSelectOptions, destroySelect, destroyAll } from './select-search.js';
 *
 *   // Inicializar
 *   const sel = initSelect('mi-select', { placeholder: 'Buscar...' });
 *
 *   // Actualizar opciones dinámicamente (cascading)
 *   updateSelectOptions('mi-select', [{ value: 1, text: 'Opción 1' }, ...], valorSeleccionado);
 *
 *   // Limpiar en onDestroy
 *   destroyAll();
 */

const instances = new Map();

/**
 * Crea (o recrea) un Tom Select en el elemento dado.
 * @param {string} elementId - ID del <select> original
 * @param {object} customConfig - Config extra para Tom Select
 * @returns {TomSelect|null}
 */
export function initSelect(elementId, customConfig = {}) {
    destroySelect(elementId);

    const el = document.getElementById(elementId);
    if (!el) return null;

    // Si está disabled o vacío, no lo inicializamos (se habilita después)
    if (el.disabled) return null;

    const config = {
        maxOptions: 200,
        maxItems: 1,
        placeholder: el.options[0]?.text || 'Seleccionar...',
        allowEmptyOption: false,
        onDropdownOpen: () => {
            // Pequeño fix para Bootstrap 5 z-index
            const dd = el.tomselect?.dropdown;
            if (dd) dd.style.zIndex = '9999';
        },
        ...customConfig,
    };

    try {
        const instance = new TomSelect(el, config);
        instances.set(elementId, instance);
        return instance;
    } catch {
        // Si falla (ej: elemento inválido), continuar sin TS
        return null;
    }
}

/**
 * Actualiza las opciones de un Tom Select (para cascading).
 */
export function updateSelectOptions(elementId, options, selectedValue = null) {
    const instance = instances.get(elementId);
    if (!instance) return;

    const opts = options.map(o => ({
        value: String(o.value ?? o.id ?? ''),
        text: String(o.text ?? o.name ?? ''),
    }));

    instance.clearOptions();
    instance.addOptions(opts);

    if (opts.length > 0) {
        instance.clear(true); // clear silencioso
        if (selectedValue !== null && selectedValue !== '') {
            instance.setValue(String(selectedValue), true); // silencioso
        }
        instance.refreshOptions();
    } else {
        instance.clear(true);
        instance.refreshOptions();
    }
}

/**
 * Habilita un Tom Select (útil para cascading).
 */
export function enableSelect(elementId) {
    const instance = instances.get(elementId);
    if (instance) instance.setActive(true);
}

/**
 * Deshabilita un Tom Select.
 */
export function disableSelect(elementId) {
    const instance = instances.get(elementId);
    if (instance) instance.setActive(false);
}

/**
 * Destruye un Tom Select y restaura el <select> original.
 */
export function destroySelect(elementId) {
    if (instances.has(elementId)) {
        try {
            instances.get(elementId).destroy();
        } catch { /* ignore */ }
        instances.delete(elementId);
    }
}

/**
 * Destruye TODAS las instancias (llamar en onDestroy del componente).
 */
export function destroyAll() {
    for (const [id] of instances) {
        destroySelect(id);
    }
}

/**
 * Obtiene la instancia de Tom Select para un elemento.
 */
export function getSelect(elementId) {
    return instances.get(elementId) ?? null;
}

/**
 * Limpia el valor de un Tom Select (útil para botones "limpiar filtros").
 */
export function clearSelect(elementId) {
    const instance = instances.get(elementId);
    if (instance) {
        instance.clear();
    }
}
