<?php

declare(strict_types=1);

namespace App\Domains\Auth\Contracts;

use App\Domains\Auth\Exceptions\InvalidFirebaseTokenException;
use App\Domains\Auth\Services\VerifiedFirebaseToken;

/**
 * Contract for verifying a Firebase ID token. The concrete
 * implementation (KreaitFirebaseTokenVerifier) wraps the kreait
 * SDK; tests bind FakeFirebaseTokenVerifier to the container so the
 * full /auth/google endpoint runs without real Firebase credentials.
 *
 * Throws InvalidFirebaseTokenException for malformed, expired,
 * revoked or otherwise unverifiable tokens. Callers MUST map that
 * exception to HTTP 401.
 */
interface FirebaseTokenVerifier
{
    /**
     * @throws InvalidFirebaseTokenException
     */
    public function verify(string $idToken): VerifiedFirebaseToken;
}
