/**
 * table-actions component — unit tests
 *
 * Tests the table-actions component's rendering, permission filtering,
 * CustomEvent emission, and cleanup behavior.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { clearAuthState, setAccessToken } from '../../core/http.service.js';

vi.mock('../../core/http.service.js', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    http: { get: vi.fn() },
  };
});

// Mock bootstrap.Dropdown globally
class MockDropdown {
  constructor(el) {
    this._el = el;
    el._bootstrapDropdown = this;
  }
  show() {
    this._el.setAttribute('aria-expanded', 'true');
  }
  hide() {
    this._el.setAttribute('aria-expanded', 'false');
  }
  dispose() {
    delete this._el._bootstrapDropdown;
  }
  static getInstance(el) {
    return el._bootstrapDropdown || null;
  }
}

// Mock fetch for the HTML template (matches the actual component template)
const TEMPLATE_HTML = `<div class="d-flex justify-content-center gap-1">
  <a class="btn btn-sm btn-outline-primary btn-ver" href="#" data-action="view" aria-label="Ver detalle">
    <i class="fa-solid fa-eye"></i>
  </a>
  <div class="dropdown">
    <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button"
            data-bs-toggle="dropdown" aria-expanded="false" aria-label="Acciones">
      <i class="fa-solid fa-ellipsis-v"></i>
    </button>
    <ul class="dropdown-menu dropdown-menu-end">
      <li class="table-actions-edit-item" data-action="edit" style="display:none">
        <a class="dropdown-item table-actions-edit" href="#" data-action="edit" aria-label="Editar">
          <i class="fa-solid fa-edit"></i> Editar
        </a>
      </li>
      <li class="table-actions-delete-item" data-action="delete" style="display:none">
        <a class="dropdown-item table-actions-delete text-danger" href="#" data-action="delete" aria-label="Eliminar">
          <i class="fa-solid fa-trash-alt"></i> Eliminar
        </a>
      </li>
    </ul>
  </div>
</div>`;

// Spy on the actual permission service
import { permissionService } from '../permission.service.js';

beforeEach(() => {
  clearAuthState();
  setAccessToken('test-token');

  // Reset fetch mock
  globalThis.fetch = vi.fn((url) => {
    if (url.endsWith('.html')) {
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(TEMPLATE_HTML),
      });
    }
    return Promise.reject(new Error('Unexpected fetch URL'));
  });

  // Set bootstrap mock before each test
  globalThis.bootstrap = { Dropdown: MockDropdown };
});

afterEach(() => {
  document.body.innerHTML = '';
});

// ---------------------------------------------------------------------------
// Ver button rendering
// ---------------------------------------------------------------------------

describe('Ver button', () => {
  it('renders the Ver button always, regardless of permissions', async () => {
    vi.spyOn(permissionService, 'getMyPermissions').mockResolvedValue(
      new Set(),
    );
    vi.spyOn(permissionService, 'onInvalidate').mockReturnValue(() => {});

    const { mount, unmount } = await import('./table-actions.component.js');

    const el = document.createElement('table-actions');
    document.body.appendChild(el);

    await mount(el, {
      id: '5',
      titulo: 'Bache en Rivadavia',
      slugs: { update: 'incidents.update', delete: 'incidents.delete' },
    });

    const verBtn = el.querySelector('.btn-ver');
    expect(verBtn).not.toBeNull();
    expect(verBtn.getAttribute('aria-label')).toBe('Ver detalle');

    unmount(el);
  });
});

// ---------------------------------------------------------------------------
// Permission filtering
// ---------------------------------------------------------------------------

describe('Permission filtering', () => {
  it('renders both Editar and Eliminar when user has both permissions', async () => {
    vi.spyOn(permissionService, 'getMyPermissions').mockResolvedValue(
      new Set(['incidents.update', 'incidents.delete']),
    );
    vi.spyOn(permissionService, 'onInvalidate').mockReturnValue(() => {});

    const { mount, unmount } = await import('./table-actions.component.js');

    const el = document.createElement('table-actions');
    document.body.appendChild(el);

    await mount(el, {
      id: '5',
      titulo: 'Test',
      slugs: { update: 'incidents.update', delete: 'incidents.delete' },
    });

    const editItem = el.querySelector('.table-actions-edit-item');
    const deleteItem = el.querySelector('.table-actions-delete-item');
    expect(editItem).not.toBeNull();
    expect(deleteItem).not.toBeNull();

    unmount(el);
  });

  it('renders only Eliminar when user lacks update permission', async () => {
    vi.spyOn(permissionService, 'getMyPermissions').mockResolvedValue(
      new Set(['incidents.delete']),
    );
    vi.spyOn(permissionService, 'onInvalidate').mockReturnValue(() => {});

    const { mount, unmount } = await import('./table-actions.component.js');

    const el = document.createElement('table-actions');
    document.body.appendChild(el);

    await mount(el, {
      id: '5',
      titulo: 'Test',
      slugs: { update: 'incidents.update', delete: 'incidents.delete' },
    });

    // The <li> wrapper should be removed from DOM (per spec: "shall NOT be rendered")
    expect(el.querySelector('.table-actions-edit-item')).toBeNull();
    expect(el.querySelector('.table-actions-delete-item')).not.toBeNull();

    unmount(el);
  });

  it('renders kebab disabled with tooltip when user has no actions', async () => {
    vi.spyOn(permissionService, 'getMyPermissions').mockResolvedValue(
      new Set(),
    );
    vi.spyOn(permissionService, 'onInvalidate').mockReturnValue(() => {});

    const { mount, unmount } = await import('./table-actions.component.js');

    const el = document.createElement('table-actions');
    document.body.appendChild(el);

    await mount(el, {
      id: '5',
      titulo: 'Test',
      slugs: { update: 'incidents.update', delete: 'incidents.delete' },
    });

    const toggle = el.querySelector('.dropdown-toggle');
    expect(toggle).not.toBeNull();
    expect(toggle.hasAttribute('disabled')).toBe(true);
    expect(toggle.getAttribute('title')).toBe('No tenés acciones disponibles');

    unmount(el);
  });
});

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

describe('Loading state', () => {
  it('renders kebab disabled with loading tooltip before permissions resolve', async () => {
    let resolvePerms;
    vi.spyOn(permissionService, 'getMyPermissions').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePerms = resolve;
        }),
    );
    vi.spyOn(permissionService, 'onInvalidate').mockReturnValue(() => {});

    const { mount, unmount } = await import('./table-actions.component.js');

    const el = document.createElement('table-actions');
    document.body.appendChild(el);

    mount(el, {
      id: '5',
      titulo: 'Test',
      slugs: { update: 'incidents.update', delete: 'incidents.delete' },
    });

    // Wait a tick for the mount to start
    await new Promise((r) => setTimeout(r, 0));

    const toggle = el.querySelector('.dropdown-toggle');
    expect(toggle).not.toBeNull();
    expect(toggle.hasAttribute('disabled')).toBe(true);
    expect(toggle.getAttribute('title')).toBe('Cargando permisos…');

    // Resolve permissions
    resolvePerms(new Set(['incidents.update']));

    unmount(el);
  });
});

// ---------------------------------------------------------------------------
// CustomEvent emission
// ---------------------------------------------------------------------------

describe('CustomEvent emission', () => {
  it('emits table-actions:view with correct detail when Ver is clicked', async () => {
    vi.spyOn(permissionService, 'getMyPermissions').mockResolvedValue(
      new Set(['incidents.update', 'incidents.delete']),
    );
    vi.spyOn(permissionService, 'onInvalidate').mockReturnValue(() => {});

    const { mount, unmount } = await import('./table-actions.component.js');

    const el = document.createElement('table-actions');
    document.body.appendChild(el);

    await mount(el, {
      id: '5',
      titulo: 'Bache en Rivadavia',
      slugs: { update: 'incidents.update', delete: 'incidents.delete' },
    });

    const receivedEvents = [];
    el.addEventListener('table-actions:view', (e) => receivedEvents.push(e));

    const verBtn = el.querySelector('.btn-ver');
    verBtn.click();

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].detail).toEqual({
      id: '5',
      titulo: 'Bache en Rivadavia',
    });

    unmount(el);
  });

  it('emits table-actions:edit with correct detail when Editar is clicked', async () => {
    vi.spyOn(permissionService, 'getMyPermissions').mockResolvedValue(
      new Set(['incidents.update', 'incidents.delete']),
    );
    vi.spyOn(permissionService, 'onInvalidate').mockReturnValue(() => {});

    const { mount, unmount } = await import('./table-actions.component.js');

    const el = document.createElement('table-actions');
    document.body.appendChild(el);

    await mount(el, {
      id: '5',
      titulo: 'Bache en Rivadavia',
      slugs: { update: 'incidents.update', delete: 'incidents.delete' },
    });

    const receivedEvents = [];
    el.addEventListener('table-actions:edit', (e) => receivedEvents.push(e));

    // Open dropdown then click Editar
    const toggle = el.querySelector('.dropdown-toggle');
    toggle.click();
    const editItem = el.querySelector('.table-actions-edit');
    editItem.click();

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].detail).toEqual({
      id: '5',
      titulo: 'Bache en Rivadavia',
    });

    unmount(el);
  });

  it('emits table-actions:delete with correct detail when Eliminar is clicked', async () => {
    vi.spyOn(permissionService, 'getMyPermissions').mockResolvedValue(
      new Set(['incidents.update', 'incidents.delete']),
    );
    vi.spyOn(permissionService, 'onInvalidate').mockReturnValue(() => {});

    const { mount, unmount } = await import('./table-actions.component.js');

    const el = document.createElement('table-actions');
    document.body.appendChild(el);

    await mount(el, {
      id: '5',
      titulo: 'Bache en Rivadavia',
      slugs: { update: 'incidents.update', delete: 'incidents.delete' },
    });

    const receivedEvents = [];
    el.addEventListener('table-actions:delete', (e) => receivedEvents.push(e));

    const toggle = el.querySelector('.dropdown-toggle');
    toggle.click();
    const deleteItem = el.querySelector('.table-actions-delete');
    deleteItem.click();

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].detail).toEqual({
      id: '5',
      titulo: 'Bache en Rivadavia',
    });

    unmount(el);
  });
});

// ---------------------------------------------------------------------------
// CustomEvent bubbling for delegated listeners (REQ-FRONTEND-EVENTS)
// ---------------------------------------------------------------------------
// Index pages attach `table-actions:*` listeners to a parent container
// (the <tbody> or a card container) and rely on event delegation. The
// component MUST dispatch with `bubbles: true` — otherwise the events
// stay on the <table-actions> host and the parent listener never fires,
// so clicks on Ver / Editar / Eliminar appear to do nothing.
//
// These tests mount the component inside a wrapper parent (the realistic
// wiring) and assert the event reaches the parent AND that the event
// itself is marked bubbles:true.

describe('CustomEvent bubbling for delegated listeners', () => {
  async function mountInParent() {
    vi.spyOn(permissionService, 'getMyPermissions').mockResolvedValue(
      new Set(['incidents.update', 'incidents.delete']),
    );
    vi.spyOn(permissionService, 'onInvalidate').mockReturnValue(() => {});

    const { mount, unmount } = await import('./table-actions.component.js');

    const parent = document.createElement('tbody');
    parent.id = 'parent-tbody';
    const host = document.createElement('table-actions');
    parent.appendChild(host);
    document.body.appendChild(parent);

    await mount(host, {
      id: '5',
      titulo: 'Bache en Rivadavia',
      slugs: { update: 'incidents.update', delete: 'incidents.delete' },
    });

    return { parent, host, unmount };
  }

  it('table-actions:view bubbles from host to parent listener', async () => {
    const { parent, host, unmount } = await mountInParent();
    const received = [];
    parent.addEventListener('table-actions:view', (e) => received.push(e));

    host.querySelector('.btn-ver').click();

    expect(received).toHaveLength(1);
    expect(received[0].bubbles).toBe(true);
    expect(received[0].detail).toEqual({
      id: '5',
      titulo: 'Bache en Rivadavia',
    });

    unmount(host);
  });

  it('table-actions:edit bubbles from host to parent listener', async () => {
    const { parent, host, unmount } = await mountInParent();
    const received = [];
    parent.addEventListener('table-actions:edit', (e) => received.push(e));

    host.querySelector('.dropdown-toggle').click();
    host.querySelector('.table-actions-edit').click();

    expect(received).toHaveLength(1);
    expect(received[0].bubbles).toBe(true);
    expect(received[0].detail).toEqual({
      id: '5',
      titulo: 'Bache en Rivadavia',
    });

    unmount(host);
  });

  it('table-actions:delete bubbles from host to parent listener', async () => {
    const { parent, host, unmount } = await mountInParent();
    const received = [];
    parent.addEventListener('table-actions:delete', (e) => received.push(e));

    host.querySelector('.dropdown-toggle').click();
    host.querySelector('.table-actions-delete').click();

    expect(received).toHaveLength(1);
    expect(received[0].bubbles).toBe(true);
    expect(received[0].detail).toEqual({
      id: '5',
      titulo: 'Bache en Rivadavia',
    });

    unmount(host);
  });
});

// ---------------------------------------------------------------------------
// Eliminar styling
// ---------------------------------------------------------------------------

describe('Eliminar styling', () => {
  it('Eliminar item has text-danger class', async () => {
    vi.spyOn(permissionService, 'getMyPermissions').mockResolvedValue(
      new Set(['incidents.delete']),
    );
    vi.spyOn(permissionService, 'onInvalidate').mockReturnValue(() => {});

    const { mount, unmount } = await import('./table-actions.component.js');

    const el = document.createElement('table-actions');
    document.body.appendChild(el);

    await mount(el, {
      id: '5',
      titulo: 'Test',
      slugs: { update: 'incidents.update', delete: 'incidents.delete' },
    });

    const deleteItem = el.querySelector('.table-actions-delete');
    expect(deleteItem.classList.contains('text-danger')).toBe(true);

    unmount(el);
  });
});

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

describe('Cleanup', () => {
  it('calls bootstrap.Dropdown.dispose() on unmount', async () => {
    vi.spyOn(permissionService, 'getMyPermissions').mockResolvedValue(
      new Set(['incidents.update', 'incidents.delete']),
    );
    vi.spyOn(permissionService, 'onInvalidate').mockReturnValue(() => {});

    const { mount, unmount } = await import('./table-actions.component.js');

    const el = document.createElement('table-actions');
    document.body.appendChild(el);

    await mount(el, {
      id: '5',
      titulo: 'Test',
      slugs: { update: 'incidents.update', delete: 'incidents.delete' },
    });

    const toggle = el.querySelector('.dropdown-toggle');
    const dropdownInstance = bootstrap.Dropdown.getInstance(toggle);
    expect(dropdownInstance).not.toBeNull();

    unmount(el);

    // After unmount, the dropdown instance should be disposed
    expect(bootstrap.Dropdown.getInstance(toggle)).toBeNull();
  });

  it('removes onInvalidate listener on unmount', async () => {
    const unsubscribe = vi.fn();
    vi.spyOn(permissionService, 'getMyPermissions').mockResolvedValue(
      new Set(['incidents.update', 'incidents.delete']),
    );
    vi.spyOn(permissionService, 'onInvalidate').mockImplementation(
      () => unsubscribe,
    );

    const { mount, unmount } = await import('./table-actions.component.js');

    const el = document.createElement('table-actions');
    document.body.appendChild(el);

    await mount(el, {
      id: '5',
      titulo: 'Test',
      slugs: { update: 'incidents.update', delete: 'incidents.delete' },
    });

    unmount(el);

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Live re-hydration
// ---------------------------------------------------------------------------

describe('Live re-hydration', () => {
  it('re-hydrates when permissionService emits invalidation', async () => {
    let rehydrateCb = null;
    vi.spyOn(permissionService, 'getMyPermissions').mockResolvedValue(
      new Set(['incidents.update', 'incidents.delete']),
    );
    vi.spyOn(permissionService, 'onInvalidate').mockImplementation((cb) => {
      rehydrateCb = cb;
      return () => {};
    });

    const { mount, unmount } = await import('./table-actions.component.js');

    const el = document.createElement('table-actions');
    document.body.appendChild(el);

    await mount(el, {
      id: '5',
      titulo: 'Test',
      slugs: { update: 'incidents.update', delete: 'incidents.delete' },
    });

    // Initially has both items
    expect(el.querySelector('.table-actions-edit-item')).not.toBeNull();
    expect(el.querySelector('.table-actions-delete-item')).not.toBeNull();

    // Simulate permission change: only delete remains
    vi.spyOn(permissionService, 'getMyPermissions').mockResolvedValue(
      new Set(['incidents.delete']),
    );

    // Trigger re-hydration by calling the stored callback
    if (rehydrateCb) {
      rehydrateCb();
      // Wait for the async rehydrate to complete
      await new Promise((r) => setTimeout(r, 0));
    }

    // After re-hydration, edit item should be removed from DOM (no update permission)
    expect(el.querySelector('.table-actions-edit-item')).toBeNull();
    // Delete item should still be there
    expect(el.querySelector('.table-actions-delete-item')).not.toBeNull();

    unmount(el);
  });
});

// ---------------------------------------------------------------------------
// PR1 review robustness regressions
// ---------------------------------------------------------------------------
// RES-1: double mount leaks Dropdown instance and PubSub listener
// RES-2: uncaught rejection if getMyPermissions() fails
// RES-3: uncaught error if fetchTemplate() fails
// REL-1: renderDropdownItems crashes on null element references
// REL-2: rehydrate calls dropdown.hide() with no null guard

describe('Robustness regressions (PR1 review)', () => {
  describe('RES-1: double mount guard', () => {
    it('throws when mount is called twice on the same element', async () => {
      vi.spyOn(permissionService, 'getMyPermissions').mockResolvedValue(
        new Set(),
      );
      vi.spyOn(permissionService, 'onInvalidate').mockReturnValue(() => {});

      const { mount, unmount } = await import('./table-actions.component.js');

      const el = document.createElement('table-actions');
      document.body.appendChild(el);

      await mount(el, {
        id: '1',
        titulo: 'T',
        slugs: { update: 'incidents.update', delete: 'incidents.delete' },
      });

      await expect(
        mount(el, {
          id: '1',
          titulo: 'T',
          slugs: { update: 'incidents.update', delete: 'incidents.delete' },
        }),
      ).rejects.toThrow(/already[- ]mounted|already exists|double mount/i);

      unmount(el);
    });

    it('does not register a second PubSub listener when mount is called twice', async () => {
      const onInvalidateSpy = vi
        .spyOn(permissionService, 'onInvalidate')
        .mockReturnValue(() => {});
      vi.spyOn(permissionService, 'getMyPermissions').mockResolvedValue(
        new Set(),
      );

      const { mount, unmount } = await import('./table-actions.component.js');

      const el = document.createElement('table-actions');
      document.body.appendChild(el);

      await mount(el, {
        id: '1',
        titulo: 'T',
        slugs: { update: 'incidents.update', delete: 'incidents.delete' },
      });
      expect(onInvalidateSpy).toHaveBeenCalledTimes(1);

      // Second mount must fail WITHOUT registering a second listener
      await expect(
        mount(el, {
          id: '1',
          titulo: 'T',
          slugs: { update: 'incidents.update', delete: 'incidents.delete' },
        }),
      ).rejects.toThrow();
      expect(onInvalidateSpy).toHaveBeenCalledTimes(1);

      unmount(el);
    });
  });

  describe('RES-2: getMyPermissions rejection', () => {
    it('renders error state on the kebab when getMyPermissions rejects', async () => {
      vi.spyOn(permissionService, 'getMyPermissions').mockRejectedValue(
        new Error('Network error'),
      );
      vi.spyOn(permissionService, 'onInvalidate').mockReturnValue(() => {});

      const { mount, unmount } = await import('./table-actions.component.js');

      const el = document.createElement('table-actions');
      document.body.appendChild(el);

      // mount() must NOT propagate the rejection
      await expect(
        mount(el, {
          id: '1',
          titulo: 'T',
          slugs: { update: 'incidents.update', delete: 'incidents.delete' },
        }),
      ).resolves.toBeUndefined();

      const toggle = el.querySelector('.dropdown-toggle');
      expect(toggle).not.toBeNull();
      // Still disabled (no usable permissions), but tooltip is the ERROR state,
      // not the loading state.
      expect(toggle.hasAttribute('disabled')).toBe(true);
      expect(toggle.getAttribute('title')).not.toBe('Cargando permisos…');
      expect(toggle.getAttribute('title')).toMatch(/error/i);

      unmount(el);
    });
  });

  describe('RES-3: fetchTemplate failure', () => {
    it('rejects with descriptive error and leaves clean DOM when template fetch fails', async () => {
      globalThis.fetch = vi.fn((url) => {
        if (url.endsWith('.html')) {
          return Promise.reject(new Error('boom: template network error'));
        }
        return Promise.reject(new Error('Unexpected fetch URL'));
      });

      vi.spyOn(permissionService, 'getMyPermissions').mockResolvedValue(
        new Set(),
      );
      vi.spyOn(permissionService, 'onInvalidate').mockReturnValue(() => {});

      const { mount } = await import('./table-actions.component.js');

      const el = document.createElement('table-actions');
      document.body.appendChild(el);

      await expect(
        mount(el, {
          id: '1',
          titulo: 'T',
          slugs: { update: 'incidents.update', delete: 'incidents.delete' },
        }),
      ).rejects.toThrow();

      // DOM must be cleaned up — no partial children left
      expect(el.innerHTML).toBe('');
    });

    it('rejects with descriptive error when template body has no children', async () => {
      // Browser/jsdom auto-adds <head>/<body> wrappers, so <html></html> yields
      // a doc whose body.children is empty.
      globalThis.fetch = vi.fn((url) => {
        if (url.endsWith('.html')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve('<html></html>'),
          });
        }
        return Promise.reject(new Error('Unexpected fetch URL'));
      });

      vi.spyOn(permissionService, 'getMyPermissions').mockResolvedValue(
        new Set(),
      );
      vi.spyOn(permissionService, 'onInvalidate').mockReturnValue(() => {});

      const { mount } = await import('./table-actions.component.js');

      const el = document.createElement('table-actions');
      document.body.appendChild(el);

      await expect(
        mount(el, {
          id: '1',
          titulo: 'T',
          slugs: { update: 'incidents.update', delete: 'incidents.delete' },
        }),
      ).rejects.toThrow(/template/i);

      expect(el.innerHTML).toBe('');
    });
  });

  describe('REL-1: renderDropdownItems null guards', () => {
    it('does not crash when the template omits the edit <li>', async () => {
      const partialTemplate = `<div class="d-flex justify-content-center gap-1">
  <a class="btn btn-sm btn-outline-primary btn-ver" href="#" data-action="view" aria-label="Ver detalle">
    <i class="fa-solid fa-eye"></i>
  </a>
  <div class="dropdown">
    <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button"
            data-bs-toggle="dropdown" aria-expanded="false" aria-label="Acciones">
      <i class="fa-solid fa-ellipsis-v"></i>
    </button>
    <ul class="dropdown-menu dropdown-menu-end">
      <li class="table-actions-delete-item" data-action="delete" style="display:none">
        <a class="dropdown-item table-actions-delete text-danger" href="#" data-action="delete" aria-label="Eliminar">
          <i class="fa-solid fa-trash-alt"></i> Eliminar
        </a>
      </li>
    </ul>
  </div>
</div>`;

      globalThis.fetch = vi.fn((url) => {
        if (url.endsWith('.html')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve(partialTemplate),
          });
        }
        return Promise.reject(new Error('Unexpected fetch URL'));
      });

      vi.spyOn(permissionService, 'getMyPermissions').mockResolvedValue(
        new Set(['incidents.update', 'incidents.delete']),
      );
      vi.spyOn(permissionService, 'onInvalidate').mockReturnValue(() => {});

      const { mount, unmount } = await import('./table-actions.component.js');

      const el = document.createElement('table-actions');
      document.body.appendChild(el);

      await expect(
        mount(el, {
          id: '1',
          titulo: 'T',
          slugs: { update: 'incidents.update', delete: 'incidents.delete' },
        }),
      ).resolves.toBeUndefined();

      // Component degrades gracefully: delete item is present, edit is not.
      expect(el.querySelector('.table-actions-edit-item')).toBeNull();
      expect(el.querySelector('.table-actions-delete-item')).not.toBeNull();

      unmount(el);
    });
  });

  describe('REL-2: rehydrate dropdown null guard', () => {
    it('does not call dropdown.hide() on the rehydrate path after unmount', async () => {
      let rehydrateCb = null;
      vi.spyOn(permissionService, 'getMyPermissions').mockResolvedValue(
        new Set(['incidents.update']),
      );
      vi.spyOn(permissionService, 'onInvalidate').mockImplementation((cb) => {
        rehydrateCb = cb;
        return () => {};
      });

      const { mount, unmount } = await import('./table-actions.component.js');

      const el = document.createElement('table-actions');
      document.body.appendChild(el);

      await mount(el, {
        id: '1',
        titulo: 'T',
        slugs: { update: 'incidents.update', delete: 'incidents.delete' },
      });

      const toggle = el.querySelector('.dropdown-toggle');
      const dropdown = bootstrap.Dropdown.getInstance(toggle);
      expect(dropdown).not.toBeNull();

      // Simulate a real Bootstrap Dropdown that crashes when hide() is called
      // after dispose(). This proves the production guard works: hide() must
      // not be invoked once the instance has been disposed via unmount().
      const hideSpy = vi.spyOn(dropdown, 'hide').mockImplementation(() => {
        throw new Error('hide() called on disposed Dropdown');
      });

      unmount(el);

      // Trigger the leaked rehydrate — must NOT throw, must NOT call hide()
      await expect(rehydrateCb()).resolves.not.toThrow();
      expect(hideSpy).not.toHaveBeenCalled();
    });
  });
});
