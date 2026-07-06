import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setAccessToken, clearAuthState } from '../core/http.service.js';

vi.mock('../core/http.service.js', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    http: {
      get: vi.fn(),
      patch: vi.fn(),
    },
  };
});

import { http } from '../core/http.service.js';
import { notificationService } from './notification.service.js';

describe('notificationService', () => {
  beforeEach(() => {
    clearAuthState();
    setAccessToken('test-token');
    notificationService.clearCache();
    vi.clearAllMocks();
  });

  it('list fetches notifications and returns data shape', async () => {
    http.get.mockResolvedValue({
      data: [{ id: 1, type: 'claim', message: 'x', read: false, data: {}, created_at: '2026-07-06' }],
      meta: { total: 1 },
      unread_count: 1,
    });

    const result = await notificationService.list({ page: 1, perPage: 10 });

    expect(http.get).toHaveBeenCalledWith(expect.stringContaining('/notifications?'));
    expect(result.data).toHaveLength(1);
    expect(result.unreadCount).toBe(1);
  });

  it('list sends unread_only when requested', async () => {
    http.get.mockResolvedValue({ data: [], unread_count: 0 });

    await notificationService.list({ unreadOnly: true });

    expect(http.get).toHaveBeenCalledWith(expect.stringContaining('unread_only=1'));
  });

  it('unreadCount caches the response', async () => {
    http.get.mockResolvedValue({ unread_count: 5 });

    const first = await notificationService.unreadCount();
    const second = await notificationService.unreadCount();
    const third = await notificationService.unreadCount();

    expect(first).toBe(5);
    expect(second).toBe(5);
    expect(third).toBe(5);
    expect(http.get).toHaveBeenCalledTimes(1);
  });

  it('unreadCount with force refetches', async () => {
    http.get.mockResolvedValue({ unread_count: 3 });

    await notificationService.unreadCount();
    await notificationService.unreadCount({ force: true });

    expect(http.get).toHaveBeenCalledTimes(2);
  });

  it('markRead invalidates the unread count cache', async () => {
    http.get.mockResolvedValue({ unread_count: 2 });
    http.patch.mockResolvedValue({});

    await notificationService.unreadCount();
    await notificationService.markRead(99);

    // After markRead the cache is invalidated — next unreadCount re-fetches.
    await notificationService.unreadCount();
    expect(http.get).toHaveBeenCalledTimes(2);
  });

  it('markAllRead resets the cache to 0', async () => {
    http.get.mockResolvedValue({ unread_count: 7 });
    http.patch.mockResolvedValue({ updated: 7, unread_count: 0 });

    await notificationService.unreadCount();
    const after = await notificationService.markAllRead();

    expect(after.updated).toBe(7);

    // Cached value is now 0, no extra fetch.
    const cached = await notificationService.unreadCount();
    expect(cached).toBe(0);
    expect(http.get).toHaveBeenCalledTimes(1);
  });
});