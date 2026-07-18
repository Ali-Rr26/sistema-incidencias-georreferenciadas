/**
 * table-actions — Shared row-level component for Ver + kebab dropdown.
 *
 * Renders a Ver icon-button (always visible when page is authorized) and a
 * Bootstrap 5 kebab dropdown with Editar / Eliminar items filtered by the
 * user's permission slugs. Emits CustomEvents on the host element so index
 * pages can handle them via delegation.
 *
 * Usage:
 *   import { mount, unmount } from './table-actions.component.js';
 *   const el = document.createElement('table-actions');
 *   document.body.appendChild(el);
 *   mount(el, { id, titulo, slugs: { update, delete } });
 *
 * Events emitted on the host element:
 *   table-actions:view  — detail: { id, titulo }
 *   table-actions:edit  — detail: { id, titulo }
 *   table-actions:delete — detail: { id, titulo }
 */

import { permissionService } from '../permission.service.js';

export const templateUrl = 'app/shared/table-actions/table-actions.component.html';

// WeakMap: host element → instance data
const INSTANCES = new WeakMap();

/**
 * @param {string} url
 * @returns {Promise<string>}
 */
async function fetchTemplate(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load template: ${url}`);
  return res.text();
}

/**
 * Internal: builds the CustomEvent detail from ctx.
 */
function eventDetail(ctx) {
  return { id: ctx.id, titulo: ctx.titulo };
}

/**
 * Internal: disposes the Bootstrap Dropdown instance on the toggle element.
 */
function disposeDropdown(toggleEl) {
  const instance = bootstrap.Dropdown.getInstance(toggleEl);
  if (instance) {
    instance.dispose();
  }
}

/**
 * Internal: sets dropdown items visibility based on permissions.
 * Called both on initial hydration and on re-hydration.
 * Items not in the user's set are removed from DOM (per spec).
 *
 * @param {HTMLElement} el — host element
 * @param {Set<string>} perms — user's permission set
 * @param {{ update: string, delete: string }} slugs
 */
function renderDropdownItems(el, perms, slugs) {
  const hasUpdate = perms.has(slugs.update);
  const hasDelete = perms.has(slugs.delete);

  const editLi = el.querySelector('.table-actions-edit-item');
  const deleteLi = el.querySelector('.table-actions-delete-item');
  const toggle = el.querySelector('.dropdown-toggle');

  if (editLi) {
    if (hasUpdate) {
      editLi.style.display = '';
    } else {
      editLi.remove();
    }
  }
  if (deleteLi) {
    if (hasDelete) {
      deleteLi.style.display = '';
    } else {
      deleteLi.remove();
    }
  }

  if (hasUpdate || hasDelete) {
    toggle.removeAttribute('disabled');
    toggle.removeAttribute('title');
  } else {
    toggle.setAttribute('disabled', '');
    toggle.setAttribute('title', 'No tenés acciones disponibles');
  }
}

/**
 * Internal: sets the loading state on the kebab toggle.
 */
function setLoadingState(el) {
  const toggle = el.querySelector('.dropdown-toggle');
  toggle.setAttribute('disabled', '');
  toggle.setAttribute('title', 'Cargando permisos…');
}

/**
 * Internal: subscribes to permission invalidation and returns an unsubscribe fn.
 */
function subscribeToInvalidation(el, rehydrate) {
  return permissionService.onInvalidate(rehydrate);
}

/**
 * Mounts the table-actions component onto a host element.
 *
 * @param {HTMLElement} el — host <table-actions> element
 * @param {{ id: string, titulo: string, slugs: { update: string, delete: string } }} ctx
 */
export async function mount(el, ctx) {
  // Fetch and parse template
  const html = await fetchTemplate(templateUrl);
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const fragment = doc.body.children[0];

  // Append to host
  el.appendChild(fragment);

  // Wire Ver button
  const verBtn = el.querySelector('.btn-ver');
  verBtn.addEventListener('click', (e) => {
    e.preventDefault();
    el.dispatchEvent(new CustomEvent('table-actions:view', { detail: eventDetail(ctx) }));
  });

  // Wire Editar and Eliminar items (always, but they may be hidden by permissions)
  const editItem = el.querySelector('.table-actions-edit');
  const deleteItem = el.querySelector('.table-actions-delete');

  editItem.addEventListener('click', (e) => {
    e.preventDefault();
    el.dispatchEvent(new CustomEvent('table-actions:edit', { detail: eventDetail(ctx) }));
  });

  deleteItem.addEventListener('click', (e) => {
    e.preventDefault();
    el.dispatchEvent(new CustomEvent('table-actions:delete', { detail: eventDetail(ctx) }));
  });

  // Initialize Bootstrap Dropdown
  const toggle = el.querySelector('.dropdown-toggle');
  const dropdown = new bootstrap.Dropdown(toggle);

  // Re-hydration callback
  const rehydrate = async () => {
    // Close dropdown if open
    dropdown.hide();

    // Re-fetch permissions (uses cache if fresh)
    const perms = await permissionService.getMyPermissions();
    renderDropdownItems(el, perms, ctx.slugs);
  };

  // Subscribe to invalidation
  const unsubscribeInvalidate = subscribeToInvalidation(el, rehydrate);

  // Initial hydration
  setLoadingState(el);
  const perms = await permissionService.getMyPermissions();
  renderDropdownItems(el, perms, ctx.slugs);

  // Store instance data
  INSTANCES.set(el, { dropdown, unsubscribeInvalidate, ctx });
}

/**
 * Unmounts (tears down) the table-actions component from a host element.
 *
 * @param {HTMLElement} el — host <table-actions> element
 */
export function unmount(el) {
  const inst = INSTANCES.get(el);
  if (!inst) return;

  const { unsubscribeInvalidate } = inst;

  // Dispose Bootstrap Dropdown
  disposeDropdown(el.querySelector('.dropdown-toggle'));

  // Unsubscribe from permission invalidation
  unsubscribeInvalidate();

  // Remove all child nodes
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }

  INSTANCES.delete(el);
}
