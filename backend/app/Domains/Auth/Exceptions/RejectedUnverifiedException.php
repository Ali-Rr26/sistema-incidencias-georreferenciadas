<?php

declare(strict_types=1);

namespace App\Domains\Auth\Exceptions;

use Symfony\Component\HttpFoundation\Response;

/**
 * Raised by AccountLinker when a Google login targets an email that
 * already exists in the system but the existing account has NOT
 * verified its email yet (i.e. the user signed up via /register and
 * never confirmed). Maps to HTTP 401 with the spec-required Spanish
 * copy — the user must use their password (and finish email
 * verification when that flow lands) to authenticate. R9.
 */
final class RejectedUnverifiedException extends AuthenticationException
{
    public function __construct(
        string $message = 'Esta cuenta ya existe, iniciá sesión con tu contraseña',
    ) {
        parent::__construct($message, null, Response::HTTP_UNAUTHORIZED);
    }
}