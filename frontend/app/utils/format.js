/**
 * Shared formatting helpers used across the admin and citizen shells.
 *
 * Single-source helpers extracted from duplicate definitions in
 * `feed/feed.component.js`, `feed/pages/detail/feed-detail.component.js`,
 * `incidencias/pages/detail/incidencias.detail.component.js`, and
 * `incidencias/pages/pendientes/pendientes.component.js`.
 *
 * `STATUS_LABEL` is re-exported from the generated
 * `utils/status.constants.js` (sourced from the `IncidentStatus` enum
 * on the backend via `incidents:generate-frontend-constants`).
 * Don't redefine it here — CI will fail.
 */

export { STATUS_LABEL } from './status.constants.js';

/**
 * Escape a string so it is safe to interpolate into an HTML template.
 * Returns an empty string for falsy input.
 */
export function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Render a Spanish "time ago" string for a given ISO date.
 *
 *   < 60s      → "justo ahora"
 *   < 60min    → "hace Xmin"
 *   < 24h      → "hace Xh"
 *   < 7d       → "hace Xd"
 *   otherwise  → short localized date
 */
export function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return 'justo ahora';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin}min`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `hace ${diffHr}h`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `hace ${diffDays}d`;
  return new Date(dateStr).toLocaleDateString('es-EC', {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Map from incident priority keys to Spanish display labels.
 */
export const PRIORITY_LABEL = Object.freeze({
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
});