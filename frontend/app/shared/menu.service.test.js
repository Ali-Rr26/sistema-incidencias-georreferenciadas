import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setAccessToken, clearAuthState } from '../core/http.service.js';

vi.mock('../core/http.service.js', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    http: {
      get: vi.fn(),
    },
  };
});

import { http } from '../core/http.service.js';
import { menuService } from './menu.service.js';

describe('menuService', () => {
  beforeEach(() => {
    clearAuthState();
    setAccessToken('test-token');
    menuService.clearCache();
    vi.clearAllMocks();
  });

  it('fetches /menus/my and returns the data array', async () => {
    const tree = [
      { id: 1, parent_id: null, name: 'Dashboard', route: '/dashboard', icon: 'fa-gauge', children: [] },
      { id: 2, parent_id: null, name: 'Incidencias', route: null, icon: 'fa-pin', children: [
        { id: 3, parent_id: 2, name: 'Lista', route: '/incidencias', icon: 'fa-list', children: [] },
      ] },
    ];
    http.get.mockResolvedValue({ data: tree });

    const result = await menuService.getMyMenu();

    expect(http.get).toHaveBeenCalledWith('/menus/my');
    expect(result).toEqual(tree);
  });

  it('caches the response and does not refetch on subsequent calls', async () => {
    http.get.mockResolvedValue({ data: [{ id: 1, name: 'X', route: '/x', icon: null, children: [] }] });

    await menuService.getMyMenu();
    await menuService.getMyMenu();
    await menuService.getMyMenu();

    expect(http.get).toHaveBeenCalledTimes(1);
  });

  it('clearCache forces a new fetch on the next call', async () => {
    http.get.mockResolvedValue({ data: [] });

    await menuService.getMyMenu();
    menuService.clearCache();
    await menuService.getMyMenu();

    expect(http.get).toHaveBeenCalledTimes(2);
  });

  it('handles missing data field gracefully (returns empty array)', async () => {
    http.get.mockResolvedValue({});

    const result = await menuService.getMyMenu();

    expect(result).toEqual([]);
  });
});