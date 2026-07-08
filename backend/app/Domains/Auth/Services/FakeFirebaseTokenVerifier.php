<?php

declare(strict_types=1);

namespace App\Domains\Auth\Services;

use App\Domains\Auth\Contracts\FirebaseTokenVerifier;
use App\Domains\Auth\Exceptions\InvalidFirebaseTokenException;

/**
 * Test double for FirebaseTokenVerifier.
 *
 * Test suites bind this to the container so the real
 * KreaitFirebaseTokenVerifier (which would otherwise call Google's
 * public-key endpoints to verify the ID token) is bypassed entirely.
 * Tests seed the fake with a map of `token-string => claim-shape`;
 * calling `verify($token)` returns a `VerifiedFirebaseToken` DTO
 * built from that map. Any token NOT present in the map raises
 * `InvalidFirebaseTokenException`, mirroring the production verifier
 * so the controller maps the failure to HTTP 401 (R10).
 *
 * Lives in `app/` (NOT `tests/`) so `App\Domains\Auth\…` autoload
 * finds it without needing the dev autoloader during feature tests.
 *
 * Expected claim shape (matches Google's ID-token body):
 *   uid            — Firebase `sub` claim
 *   email          — string
 *   email_verified — bool
 *   name           — full name (split on first whitespace)
 *   picture        — URL or null
 */
final class FakeFirebaseTokenVerifier implements FirebaseTokenVerifier
{
    /**
     * @param  array<string, array<string, mixed>>  $tokensById
     */
    public function __construct(
        private readonly array $tokensById = [],
    ) {}

    public function verify(string $idToken): VerifiedFirebaseToken
    {
        if (! array_key_exists($idToken, $this->tokensById)) {
            // Use the default spec copy — the controller maps this
            // exception to HTTP 401 and the message is part of the
            // wire contract (R10).
            throw new InvalidFirebaseTokenException;
        }

        $claims = $this->tokensById[$idToken];

        $name = (string) ($claims['name'] ?? '');
        $firstName = '';
        $lastName = '';
        if ($name !== '') {
            $parts = preg_split('/\s+/', $name, 2);
            $firstName = (string) ($parts[0] ?? '');
            $lastName = (string) ($parts[1] ?? '');
        }

        return new VerifiedFirebaseToken(
            uid: (string) ($claims['uid'] ?? ''),
            email: (string) ($claims['email'] ?? ''),
            emailVerified: (bool) ($claims['email_verified'] ?? false),
            firstName: $firstName,
            lastName: $lastName,
            pictureUrl: isset($claims['picture']) ? (string) $claims['picture'] : null,
        );
    }
}
