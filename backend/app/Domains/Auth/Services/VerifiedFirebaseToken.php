<?php

declare(strict_types=1);

namespace App\Domains\Auth\Services;

/**
 * Immutable view of the claims Google attaches to a verified Firebase
 * ID token. This is the seam between the verification layer (Kreait)
 * and the rest of the auth domain — controllers and services MUST
 * depend on this DTO, never on the raw Kreait SDK types, so the
 * FirebaseTokenVerifier contract stays mockable in tests.
 *
 * `firstName`/`lastName` are derived by splitting the `name` claim on
 * the first whitespace — a single-word name produces `firstName =
 * name` and `lastName = ''`. `pictureUrl` is null when the claim is
 * absent. The DTO never normalises `emailVerified` away from its
 * raw boolean — downstream code (`AccountLinker`) needs the exact
 * value to decide the link-or-reject branch.
 */
final readonly class VerifiedFirebaseToken
{
    public function __construct(
        public string $uid,
        public string $email,
        public bool $emailVerified,
        public string $firstName,
        public string $lastName,
        public ?string $pictureUrl,
    ) {}
}
