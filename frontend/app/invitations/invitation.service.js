/**
 * invitation.service.js — WU-4: invitation acceptance service.
 *
 * Spec: R-INV-11, R-INV-14.
 *
 * Endpoints:
 *   POST /api/invitations/{token}/accept
 *     body: { password, password_confirmation, accept_terms, terms_version }
 *     200 {message: "Cuenta activada"}
 *     404 → InvitationNotFoundError
 *     410 → InvitationGoneError
 *     422 → propagates HTTP errors (caller handles field errors)
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
    response = await http.post(
      '/invitations/accept',
      {
        token: tokenPlain,
        password,
        password_confirmation: confirmPassword,
        accept_terms: acceptTerms === true,
        terms_version: termsVersion,
      },
    );
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
