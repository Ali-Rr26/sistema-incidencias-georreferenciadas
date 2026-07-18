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

export const templateUrl =
  'app/shared/table-actions/table-actions.component.html';

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
 * Defensive: null-checks each element so a malformed template (or post-unmount
 * DOM) cannot crash the component — it just degrades silently.
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
  } else if (slugs.update) {
    console.warn(
      'table-actions: .table-actions-edit-item missing from template',
    );
  }
  if (deleteLi) {
    if (hasDelete) {
      deleteLi.style.display = '';
    } else {
      deleteLi.remove();
    }
  } else if (slugs.delete) {
    console.warn(
      'table-actions: .table-actions-delete-item missing from template',
    );
  }

  if (!toggle) {
    console.warn('table-actions: .dropdown-toggle missing from template');
    return;
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
  if (!toggle) return;
  toggle.setAttribute('disabled', '');
  toggle.setAttribute('title', 'Cargando permisos…');
}

/**
 * Internal: sets the error state on the kebab toggle when permissions fail to load.
 */
function setErrorState(el, err) {
  const toggle = el.querySelector('.dropdown-toggle');
  if (toggle) {
    toggle.setAttribute('disabled', '');
    toggle.setAttribute('title', 'Error al cargar permisos');
  }
  console.error('table-actions: failed to load permissions', err);
}

/**
 * Internal: subscribes to permission invalidation and returns an unsubscribe fn.
 */
function subscribeToInvalidation(el, rehydrate) {
  return permissionService.onInvalidate(rehydrate);
}

/**
 * Internal: removes every child node from el.
 */
function clearChildren(el) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

/**
 * Mounts the table-actions component onto a host element.
 *
 * @param {HTMLElement} el — host <table-actions> element
 * @param {{ id: string, titulo: string, slugs: { update: string, delete: string } }} ctx
 */
export async function mount(el, ctx) {
  // RES-1: guard against double mount() — the second call would leak the
  // Dropdown instance and the PubSub subscription of the first.
  if (INSTANCES.has(el)) {
    throw new Error(
      'table-actions: mount() called on already-mounted element. Call unmount(el) first.',
    );
  }

  try {
    // Fetch and parse template
    const html = await fetchTemplate(templateUrl);
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const fragment = doc.body.children[0];

    if (!fragment) {
      throw new Error(
        `table-actions: template "${templateUrl}" returned no body content`,
      );
    }

    // Append to host
    el.appendChild(fragment);

    // Wire Ver button (REL-1: defensive — log and skip if missing)
    // Note: events are dispatched with `bubbles: true` so that index pages
    // can listen on a parent container (e.g. <tbody>, .cards-container) via
    // event delegation. Without bubbling, clicks appear to do nothing.
    const verBtn = el.querySelector('.btn-ver');
    if (ctx.showView === false && verBtn) {
      verBtn.remove();
    } else if (verBtn) {
      verBtn.addEventListener('click', (e) => {
        e.preventDefault();
        el.dispatchEvent(
          new CustomEvent('table-actions:view', {
            bubbles: true,
            detail: eventDetail(ctx),
          }),
        );
      });
    } else {
      console.warn('table-actions: .btn-ver missing from template');
    }

    // Wire Editar and Eliminar items (always, but they may be hidden by permissions)
    const editItem = el.querySelector('.table-actions-edit');
    const deleteItem = el.querySelector('.table-actions-delete');

    if (editItem) {
      editItem.addEventListener('click', (e) => {
        e.preventDefault();
        el.dispatchEvent(
          new CustomEvent('table-actions:edit', {
            bubbles: true,
            detail: eventDetail(ctx),
          }),
        );
      });
    } else {
      console.warn('table-actions: .table-actions-edit missing from template');
    }

    if (deleteItem) {
      deleteItem.addEventListener('click', (e) => {
        e.preventDefault();
        el.dispatchEvent(
          new CustomEvent('table-actions:delete', {
            bubbles: true,
            detail: eventDetail(ctx),
          }),
        );
      });
    } else {
      console.warn(
        'table-actions: .table-actions-delete missing from template',
      );
    }

    // Initialize Bootstrap Dropdown (REL-1: defensive — skip wiring if missing)
    const toggle = el.querySelector('.dropdown-toggle');
    const dropdown = toggle ? new bootstrap.Dropdown(toggle) : null;
    if (!toggle) {
      console.warn('table-actions: .dropdown-toggle missing from template');
    }

    // Re-hydration callback
    const rehydrate = async () => {
      // REL-2: guard against post-unmount PubSub leaks — INSTANCES entry is
      // deleted by unmount(), so a stale rehydrate becomes a no-op.
      const inst = INSTANCES.get(el);
      if (!inst) return;
      if (inst.dropdown) inst.dropdown.hide();

      // Re-fetch permissions (uses cache if fresh)
      const perms = await permissionService.getMyPermissions();
      renderDropdownItems(el, perms, ctx.slugs);
    };

    // Subscribe to invalidation
    const unsubscribeInvalidate = subscribeToInvalidation(el, rehydrate);

    // Initial hydration — RES-2: swallow getMyPermissions rejection and render
    // an error state instead of leaving the user on the loading state forever.
    setLoadingState(el);
    try {
      const perms = await permissionService.getMyPermissions();
      renderDropdownItems(el, perms, ctx.slugs);
    } catch (permErr) {
      setErrorState(el, permErr);
    }

    // Store instance data
    INSTANCES.set(el, { dropdown, unsubscribeInvalidate, ctx });
  } catch (err) {
    // RES-3: any failure (template fetch, parse, wiring) leaves el with
    // partial DOM. Clean up and re-throw so the caller sees a meaningful error
    // and the next mount() on the same el starts from a clean slate.
    clearChildren(el);
    throw new Error(`table-actions: mount failed: ${err.message}`, {
      cause: err,
    });
  }
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
  clearChildren(el);

  INSTANCES.delete(el);
}
