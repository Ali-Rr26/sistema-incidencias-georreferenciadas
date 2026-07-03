/**
 * Shared avatar / user-display helpers used across the admin and citizen
 * shells.
 *
 * Single-source helpers extracted from `feed/feed.component.js` and
 * `feed/pages/detail/feed-detail.component.js`. The single-object-arg
 * signature on `getInitials` is intentional: it keeps the call shape
 * consistent across the four known call sites and matches the
 * `UserResource` payload shape returned by the API.
 */

/**
 * Build a 1–2 character initials badge for a user object.
 *
 *   getInitials({ first_name: 'Ada', last_name: 'Lovelace' }) → 'AL'
 *   getInitials(null)                                          → '?'
 *   getInitials({})                                            → '?'
 */
export function getInitials(user) {
  if (!user) return '?';
  const first = (user.first_name || '')[0] || '';
  const last = (user.last_name || '')[0] || '';
  return (first + last).toUpperCase() || '?';
}

/**
 * Resolve a friendly display name for a user. Falls back to a generic
 * label when the user object is missing or has no name parts.
 */
export function getUserDisplayName(user) {
  if (!user) return 'Anónimo';
  const parts = [user.first_name, user.last_name].filter(Boolean);
  return parts.length ? parts.join(' ') : 'Usuario';
}

/**
 * Resolve an avatar URL from one of the supported payload shapes.
 *
 *   - `null` / `undefined`                → null
 *   - string                              → string as-is
 *   - `{ url: '…' }`                      → `url`
 *   - `{ urls: ['…', '…'] }`              → `urls[0]`
 *   - `[{ url: '…' }, '…']`               → first item's `url` or value
 */
export function resolveAvatar(avatar) {
  if (!avatar) return null;
  if (typeof avatar === 'string') return avatar;
  if (typeof avatar === 'object') {
    if (avatar.url) return avatar.url;
    if (Array.isArray(avatar.urls) && avatar.urls.length > 0)
      return avatar.urls[0];
    if (Array.isArray(avatar) && avatar.length > 0) {
      const first = avatar[0];
      return typeof first === 'string' ? first : first?.url || null;
    }
  }
  return null;
}
