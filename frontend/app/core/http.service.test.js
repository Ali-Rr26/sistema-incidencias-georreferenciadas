import {
  clearAuthState,
  getAccessToken,
  http,
  setAccessToken,
  setSessionId,
} from './http.service.js';

function jsonResponse(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
  };
}

describe('http service', () => {
  let fetchMock;

  beforeEach(() => {
    clearAuthState();
    window.location.hash = '';
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('injects the bearer token and retries after refresh', async () => {
    setAccessToken('old-token');
    setSessionId('session-1');

    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { message: 'expired' }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          access_token: 'new-token',
          session_id: 'session-2',
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    const result = await http.get('/incidents');

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/incidents',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
        headers: { Authorization: 'Bearer old-token' },
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/auth/refresh',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/incidents',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
        headers: { Authorization: 'Bearer new-token' },
      }),
    );
  });

  it('clears state and redirects when refresh fails', async () => {
    setAccessToken('expired-token');

    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { message: 'expired' }))
      .mockResolvedValueOnce({
        status: 401,
        ok: false,
        json: vi.fn().mockResolvedValue({ message: 'refresh failed' }),
      });

    await expect(http.get('/incidents')).rejects.toThrow('Refresh failed');

    expect(window.location.hash).toBe('#/login');
    expect(getAccessToken()).toBeNull();
  });
});
