<?php

declare(strict_types=1);

namespace App\Domains\Auth\Exceptions;

use Symfony\Component\HttpFoundation\Response;

/**
 * Raised when a Firebase ID token cannot be verified — malformed,
 * expired, revoked, signed with the wrong key, or carrying the wrong
 * audience. Maps to HTTP 401 (R10).
 *
 * The default message is the spec-required Spanish copy. Callers may
 * override the message (e.g. for tests) but the status code stays 401.
 */
final class InvalidFirebaseTokenException extends AuthenticationException
{
    public function __construct(string $message = 'Token de Google inválido')
    {
        parent::__construct($message, null, Response::HTTP_UNAUTHORIZED);
    }
}