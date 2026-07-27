/**
 * invitation.service.js — WU-4: invitation acceptance service.
 *
 * Spec: R-INV-11, R-INV-14, sc-130.
 *
 * Endpoints:
 *   POST /api/invitations/{token}/accept
 *     body: { password, password_confirmation, accept_terms, terms_version }
 *     200 {message: "Cuenta activada"}
 *     404 → InvitationNotFoundError
 *     410 → InvitationGoneError
 *     422 → propagates HTTP errors (caller handles field errors)
 *
 *   GET /api/invitations/{token}/preview (sc-130 / issue #109)
 *     200 → InvitationPreview payload (status: 'pending')
 *     404 → InvitationNotFoundError
 *     410 → InvitationGoneError
 *     network/other → console.warn + returns null (graceful fallback)
 */
import { http } from '../core/http.service.js';

/**
 * Custom error classes so callers can distinguish 404 vs 410.
 * The http service propagates non-2xx responses as thrown Error objects
 * with err.status attached. We wrap them here for typed clarity.
 */
export class InvitationNotFoundError extends Error {
  constructor(message = 'Invitación inválida') {
    super(message);
    this.name = 'InvitationNotFoundError';
  }
}

export class InvitationGoneError extends Error {
  constructor(message = 'Esta invitación ya fue usada o expiró') {
    super(message);
    this.name = 'InvitationGoneError';
  }
}

/**
 * Validates the invitation-acceptance payload on the client side,
 * mirroring InvitationAcceptRequest rules.
 *
 * @param {{ password?: string, passwordConfirmation?: string, acceptTerms?: boolean }} payload
 * @returns {Record<string, string>}  empty if valid, keyed by field if invalid
 */
export function validateAcceptPayload(payload) {
  const errors = {};

  const pw = payload.password || '';
  if (pw.length < 8) {
    errors.password = 'La contraseña debe tener al menos 8 caracteres.';
  } else if (!/[A-Z]/.test(pw)) {
    errors.password = 'La contraseña debe incluir al menos una mayúscula.';
  } else if (!/[a-z]/.test(pw)) {
    errors.password = 'La contraseña debe incluir al menos una minúscula.';
  } else if (!/[0-9]/.test(pw)) {
    errors.password = 'La contraseña debe incluir al menos un dígito.';
  }

  if (!payload.passwordConfirmation || payload.passwordConfirmation !== pw) {
    errors.passwordConfirmation =
      errors.passwordConfirmation || 'Las contraseñas no coinciden.';
  }

  if (payload.acceptTerms !== true) {
    errors.acceptTerms = 'Debés aceptar los términos y condiciones.';
  }

  return errors;
}

/**
 * Live password-rule snapshot — used by the activation form's
 * "rules checklist" UI as the user types. Returns a plain object of
 * booleans; the component renders each row as ok/failing. This is a
 * UX feedback layer only: the backend regex stays the source of
 * truth and `validateAcceptPayload` is what actually blocks submit.
 *
 * Mirrors InvitationAcceptRequest rules exactly:
 *   - minLength: password length >= 8
 *   - hasUpper:  at least one A-Z
 *   - hasLower:  at least one a-z
 *   - hasDigit:  at least one 0-9
 *   - matches:   passwordConfirmation has a value AND equals password
 *               (matches is FALSE when confirm is empty — we don't
 *                tell the user 'no coinciden' before they've typed
 *                anything in the confirm field)
 *
 * @param {{ password?: string, passwordConfirmation?: string }} payload
 * @returns {{
 *   minLength: boolean,
 *   hasUpper: boolean,
 *   hasLower: boolean,
 *   hasDigit: boolean,
 *   matches: boolean,
 * }}
 */
export function livePasswordRules(payload) {
  const password = payload.password || '';
  const confirmation = payload.passwordConfirmation;

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);

  return {
    minLength: password.length >= 8,
    hasUpper,
    hasLower,
    hasDigit,
    matches:
      typeof confirmation === 'string' &&
      confirmation.length > 0 &&
      confirmation === password,
  };
}

/**
 * Password strength score (0..4) for the activation form's strength
 * meter. Mirrors the backend regex rules — UX feedback only, the
 * backend is the source of truth on submit.
 *
 *   0 = empty / no input
 *   1 = meets minimum length only (>=8 chars)
 *   2 = meets 2 of {upper, lower, digit} character classes
 *   3 = meets all 3 character classes (and length >= 8 implicitly)
 *   4 = length >= 12 AND all 3 character classes
 *
 * @param {string} password
 * @returns {0 | 1 | 2 | 3 | 4}
 */
export function scorePassword(password) {
  const pw = password || '';
  if (pw.length === 0) return 0;

  const classes =
    (/[A-Z]/.test(pw) ? 1 : 0) +
    (/[a-z]/.test(pw) ? 1 : 0) +
    (/[0-9]/.test(pw) ? 1 : 0);

  // Minimum length is a hard floor: a 3-char password with all three
  // character classes ("Aa1") is NOT a strong password — the backend
  // rejects it for failing minLength. The meter mirrors that: a
  // positive score requires >= 8 chars.
  if (pw.length >= 12 && classes === 3) return 4;
  if (pw.length >= 8 && classes === 3) return 3;
  if (pw.length >= 8 && classes >= 2) return 2;
  if (pw.length >= 8) return 1;
  return 0;
}

/**
 * Accept an invitation with the given plaintext token, setting the user's
 * password and marking T&C as accepted.
 *
 * Does NOT store any JWT — the endpoint returns 200 with a plain message.
 * The caller is responsible for redirecting to /login.
 *
 * @param {string} tokenPlain    — the raw token from the URL (?token=...)
 * @param {string} password      — the new password to set
 * @param {string} confirmPassword — password confirmation (mirrors backend confirmed rule)
 * @param {boolean} acceptTerms  — must be true
 * @param {string} [termsVersion='v0'] — terms version to record
 * @returns {Promise<{message: string}>}
 * @throws {InvitationNotFoundError} on 404
 * @throws {InvitationGoneError}     on 410
 * @throws {Error}                   on other HTTP errors (status attached)
 */
export async function acceptInvitation(
  tokenPlain,
  password,
  confirmPassword,
  acceptTerms,
  termsVersion = 'v0',
) {
  let response;
  try {
    response = await http.post('/invitations/accept', {
      token: tokenPlain,
      password,
      password_confirmation: confirmPassword,
      accept_terms: acceptTerms === true,
      terms_version: termsVersion,
    });
  } catch (err) {
    if (err.status === 404) {
      throw new InvitationNotFoundError();
    }
    if (err.status === 410) {
      throw new InvitationGoneError();
    }
    throw err;
  }
  return response;
}

/**
 * Read-only preview of an invitation's metadata. Does NOT consume the
 * token — the same token can still be passed to `acceptInvitation()`.
 *
 * Semantics:
 *   200 → returns the preview payload (organisation, inviter, role,
 *         issued/expires timestamps, terms version). Never contains
 *         PII: no email, no phone, no token material, no internal ids.
 *   404 → throws InvitationNotFoundError (token unknown)
 *   410 → throws InvitationGoneError (token expired or consumed)
 *   network or unexpected → console.warn + returns null
 *     The caller is expected to fall back gracefully: the form must
 *     remain usable even if the preview request failed (offline,
 *     transient CORS issue, etc.). Showing the activation form is
 *     always safer than blocking on a metadata fetch.
 *
 * @param {string} tokenPlain — raw token from the URL
 * @returns {Promise<object|null>} preview payload, or null on network/unexpected
 * @throws {InvitationNotFoundError}
 * @throws {InvitationGoneError}
 */
export async function previewInvitation(tokenPlain) {
  try {
    return await http.get(
      `/invitations/${encodeURIComponent(tokenPlain)}/preview`,
    );
  } catch (err) {
    if (err.status === 404) {
      throw new InvitationNotFoundError();
    }
    if (err.status === 410) {
      throw new InvitationGoneError();
    }
    // Graceful degradation — never block the form on a metadata fetch.
    console.warn(
      '[invitation] preview request failed; continuing without context',
      err,
    );
    return null;
  }
}
