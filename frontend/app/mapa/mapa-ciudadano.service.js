import { http } from '../core/http.service.js';

/**
 * Service for the citizen map view — consumes GET /incidents/feed.
 *
 * No bbox support (the feed endpoint doesn't accept it). Polling cadence
 * is 60s (slower than the admin's 15s — citizen doesn't need real-time).
 *
 * Cache semantics match the admin's `mapaService`: a 60s TTL guards
 * against thundering-herd refreshes (e.g. onInit + first poll within the
 * same minute), and callers MUST pass `force: true` for polling/manual
 * refresh to actually hit the network.
 */
class MapaCiudadanoService {
  constructor() {
    this._cache = null;
  }

  async fetchFeed({ force = false } = {}) {
    const now = Date.now();
    if (!force && this._cache && now - this._cache.ts < 60_000) {
      return this._cache.data;
    }
    const resp = await http.get('/incidents/feed?per_page=50');
    const data = resp.data ?? resp;
    const list = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data)
        ? data
        : [];
    this._cache = { data: list, ts: now };
    return list;
  }

  invalidate() {
    this._cache = null;
  }
}

export const mapaCiudadanoService = new MapaCiudadanoService();
