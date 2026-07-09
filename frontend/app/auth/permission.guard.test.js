/**
 * Permission Guard unit tests — sources authorization from menuService
 * so the sidebar and the router share exactly ONE source of truth.
 *
 * Covers:
 *   R-20: blocks citizen from admin routes (redirects to /not-found).
 *   R-21: allows admin_sistema past admin routes when menu permits.
 *   R-22: replaces roleGuard on /roles with permissionGuard.
 */
const mockMenuService = vi.hoisted(() => ({
  getMyMenu: vi.fn(),
  invalidateMyMenu: vi.fn(),
  clearCache: vi.fn(),
}));

vi.mock('../shared/menu.service.js', () => ({ menuService: mockMenuService }));

import { permissionGuard } from './permission.guard.js';

describe('permissionGuard', () => {
  beforeEach(() => {
    mockMenuService.getMyMenu.mockReset();
    mockMenuService.invalidateMyMenu.mockReset();
    mockMenuService.clearCache.mockReset();
    window.location.hash = '';
  });

  // ─── R-20: citizen is blocked from /usuarios ────────────────────────

  it('blocks citizen from /usuarios route (R-20)', async () => {
    window.location.hash = '#/usuarios';
    // Citizen's menu: no admin items at all.
    mockMenuService.getMyMenu.mockResolvedValue([
      {
        id: 1,
        name: 'Inicio',
        route: '/feed',
        icon: null,
        children: [],
      },
    ]);

    const result = await permissionGuard.canActivate({});

    expect(result).toBe(false);
    expect(window.location.hash).toBe('#/not-found');
    expect(mockMenuService.getMyMenu).toHaveBeenCalledTimes(1);
  });

  // ─── R-21: admin_sistema passes /usuarios ───────────────────────────

  it('allows admin_sistema past /usuarios route (R-21)', async () => {
    window.location.hash = '#/usuarios';
    mockMenuService.getMyMenu.mockResolvedValue([
      {
        id: 1,
        name: 'Usuarios',
        route: '/usuarios',
        icon: null,
        children: [],
      },
    ]);

    const result = await permissionGuard.canActivate({});

    expect(result).toBe(true);
    expect(window.location.hash).toBe('#/usuarios');
  });

  // ─── R-22: /roles replaces roleGuard — positive case ────────────────

  it('allows admin_sistema on /roles route when menu has /roles entry (R-22)', async () => {
    window.location.hash = '#/roles';
    mockMenuService.getMyMenu.mockResolvedValue([
      {
        id: 1,
        name: 'Roles',
        route: '/roles',
        icon: 'shield',
        children: [],
      },
    ]);

    const result = await permissionGuard.canActivate({});

    expect(result).toBe(true);
    expect(window.location.hash).toBe('#/roles');
  });

  // ─── R-22: /roles replaced guard must still deny unauthorized user ───

  it('blocks /roles route when menu has no /roles entry (R-22 regression guard)', async () => {
    window.location.hash = '#/roles';
    // Operator with no /roles entry in their menu.
    mockMenuService.getMyMenu.mockResolvedValue([
      {
        id: 1,
        name: 'Incidencias',
        route: '/incidencias',
        icon: null,
        children: [],
      },
    ]);

    const result = await permissionGuard.canActivate({});

    expect(result).toBe(false);
    expect(window.location.hash).toBe('#/not-found');
  });

  // ─── Triangulation: nested children are also recognized ──────────────

  it('recognizes routes nested under a section header (children array)', async () => {
    window.location.hash = '#/incidencias';
    // Section headers have route === null; navigable routes live under children.
    mockMenuService.getMyMenu.mockResolvedValue([
      {
        id: 1,
        name: 'Incidencias',
        route: null,
        icon: null,
        children: [
          {
            id: 2,
            name: 'Lista',
            route: '/incidencias',
            icon: null,
            children: [],
          },
        ],
      },
    ]);

    const result = await permissionGuard.canActivate({});

    expect(result).toBe(true);
    expect(window.location.hash).toBe('#/incidencias');
  });
});
