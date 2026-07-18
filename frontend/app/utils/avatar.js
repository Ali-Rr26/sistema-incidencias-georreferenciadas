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
 * Build an avatar-cell HTML string for a user object.
 *
 * Uses `profile_image_path` (normalised to /storage/… when present) via
 * `resolveAvatar()`.  Falls back to an initials badge when no image is
 * available, styled to match the admin-shell avatar pattern.
 *
 * @param {object} user  – user resource with first_name, last_name,
 *                         profile_image_path, etc.
 * @returns {string} HTML string for a table-cell <td>.
 */
export function renderAvatarCell(user) {
  const avatar = resolveAvatar(user.profile_image_path ?? null);
  if (avatar) {
    const src = user.profile_image_path ? '/storage/' + avatar : avatar;
    return `<td><img src="${src}" alt="${user.first_name ?? ''} ${user.last_name ?? ''}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;"></td>`;
  }
  const initials = getInitials(user);
  return `<td><span style="display:inline-flex;width:36px;height:36px;border-radius:50%;background:#F5F7FA;align-items:center;justify-content:center;font-size:13px;color:#434654;">${initials}</span></td>`;
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
