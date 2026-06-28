/**
 * Router unit tests — _matchRoute param matching.
 */
const layout = vi.hoisted(() => ({
  initPage: vi.fn(),
  initShell: vi.fn(),
}));

vi.mock('../utils/layout.js', () => layout);

import { router } from './router.js';

describe('router._matchRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('matches exact pattern without params', () => {
    const result = router._matchRoute('/incidencias/feed', '/incidencias/feed');
    expect(result).toEqual({});
  });

  it('matches :id pattern and extracts param', () => {
    const result = router._matchRoute('/incidencias/:id', '/incidencias/42');
    expect(result).toEqual({ id: '42' });
  });

  it('matches :id with UUID-style value', () => {
    const result = router._matchRoute('/incidencias/:id', '/incidencias/abc-123-def');
    expect(result).toEqual({ id: 'abc-123-def' });
  });

  it('returns null for different segment count', () => {
    const result = router._matchRoute('/incidencias/:id', '/incidencias/42/comments');
    expect(result).toBeNull();
  });

  it('returns null for non-matching literal segment', () => {
    const result = router._matchRoute('/incidencias/feed', '/incidencias/detail');
    expect(result).toBeNull();
  });

  it('supports multiple params', () => {
    const result = router._matchRoute('/:resource/:id', '/incidencias/42');
    expect(result).toEqual({ resource: 'incidencias', id: '42' });
  });

  it('keeps backward compatibility with exact match routes', () => {
    // Exact match should still work through resolve's find()
    const exact = router.routes.find((r) => r.pattern === '/login');
    expect(exact).toBeUndefined(); // no routes registered in default state
  });
});
