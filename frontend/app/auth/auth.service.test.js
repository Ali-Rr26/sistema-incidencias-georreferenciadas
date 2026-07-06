/**
 * auth.service tests — `logout()` cache invalidation contract
 * (T-2.10 / T-2.11 of menu-server-driven PR 2).
 *
 * Design Decision 6 + spec capability 5 (`menu-cache-invalidation`):
 *   `auth.logout()` MUST clear the menu and notification caches BEFORE
 *   notifying subscribers, so any code observing the auth-state change
 *   sees a clean cache. Cache clear must also happen when the backend
 *   `POST /logout` call rejects (5xx, network error), because the
 *   local auth state still flips to logged-out regardless.
 *
 * We stub `menuService.clearCache` and `notificationService.clearCache`
 * via `vi.mock` so we can assert on the spy directly. `http.post` is
 * mocked through the existing `http.service.js` module surface.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../core/http.service.js', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    http: {
      post: vi.fn(),
      get: vi.fn(),
    },
  };
});

vi.mock('../shared/menu.service.js', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    menuService: {
      ...mod.menuService,
      clearCache: vi.fn(),
      getMyMenu: vi.fn(),
    },
  };
});

vi.mock('../shared/notification.service.js', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    notificationService: {
      ...mod.notificationService,
      clearCache: vi.fn(),
      unreadCount: vi.fn(),
    },
  };
});

import { http } from '../core/http.service.js';
import { menuService } from '../shared/menu.service.js';
import { notificationService } from '../shared/notification.service.js';

describe('auth.logout() — cache invalidation (T-2.10 menu-server-driven)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    http.post.mockResolvedValue({ data: { ok: true } });
  });

  it('calls menuService.clearCache() during logout', async () => {
    const { auth } = await import('./auth.service.js');
    await auth.logout();
    expect(menuService.clearCache).toHaveBeenCalledTimes(1);
  });

  it('calls notificationService.clearCache() during logout', async () => {
    const { auth } = await import('./auth.service.js');
    await auth.logout();
    expect(notificationService.clearCache).toHaveBeenCalledTimes(1);
  });

  it('still clears both caches when POST /logout rejects (5xx)', async () => {
    // The current logout() wraps http.post in a try/catch so a backend
    // failure does NOT bypass local state cleanup. This test pins the
    // contract: cache must be cleared even when the server call fails.
    http.post.mockRejectedValueOnce(new Error('500 Internal Server Error'));
    const { auth } = await import('./auth.service.js');
    await expect(auth.logout()).resolves.toBeUndefined();
    expect(menuService.clearCache).toHaveBeenCalledTimes(1);
    expect(notificationService.clearCache).toHaveBeenCalledTimes(1);
  });

  it('still clears both caches when POST /logout rejects with a network error', async () => {
    http.post.mockRejectedValueOnce(new TypeError('NetworkError'));
    const { auth } = await import('./auth.service.js');
    await expect(auth.logout()).resolves.toBeUndefined();
    expect(menuService.clearCache).toHaveBeenCalledTimes(1);
    expect(notificationService.clearCache).toHaveBeenCalledTimes(1);
  });

  it('calls clearCache BEFORE notifying auth-change subscribers', async () => {
    const { auth } = await import('./auth.service.js');
    const events = [];
    const subscriber = vi.fn(() => {
      events.push('subscriber');
    });
    menuService.clearCache.mockImplementation(() => {
      events.push('menu.clearCache');
    });
    notificationService.clearCache.mockImplementation(() => {
      events.push('notification.clearCache');
    });
    auth.onAuthChange(subscriber);

    await auth.logout();

    // Both cache clears must run before the subscriber observes the
    // auth state change. If a subscriber queries menuService after the
    // notification, it must see a fresh cache.
    expect(events).toEqual([
      'menu.clearCache',
      'notification.clearCache',
      'subscriber',
    ]);
  });
});
