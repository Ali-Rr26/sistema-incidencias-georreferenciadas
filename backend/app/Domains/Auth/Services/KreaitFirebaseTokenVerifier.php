<?php

declare(strict_types=1);

namespace App\Domains\Auth\Services;

use App\Domains\Auth\Contracts\FirebaseTokenVerifier;
use App\Domains\Auth\Exceptions\InvalidFirebaseTokenException;
use Kreait\Firebase\Contract\Auth as KreaitAuth;
use Kreait\Firebase\Exception\Auth as KreaitAuthException;

/**
 * Production FirebaseTokenVerifier. Wraps the kreait/firebase-php SDK
 * and translates its exception/claim shape into the domain's own
 * types (VerifiedFirebaseToken DTO + InvalidFirebaseTokenException).
 *
 * Construction takes a Kreait Auth contract instance — the binding
 * in AppServiceProvider::register() builds it from config (the
 * FIREBASE_CREDENTIALS env var, see config/services.php). Tests bind
 * the FakeFirebaseTokenVerifier to the same contract so they never
 * touch the SDK.
 *
 * `leewayInSeconds` matches Firebase's clock-skew tolerance default
 * (5 seconds). Pass a different value via config('services.firebase.leeway_seconds').
 */
final class KreaitFirebaseTokenVerifier implements FirebaseTokenVerifier
{
    public function __construct(
        private readonly KreaitAuth $auth,
        private readonly int $leewayInSeconds = 5,
    ) {}

    public function verify(string $idToken): VerifiedFirebaseToken
    {
        try {
            $token = $this->auth->verifyIdToken(
                $idToken,
                checkIfRevoked: false,
                leewayInSeconds: $this->leewayInSeconds,
            );
        } catch (KreaitAuthException\FailedToVerifyToken) {
            // Malformed, expired, wrong audience, wrong signature.
            throw new InvalidFirebaseTokenException;
        } catch (KreaitAuthException\RevokedIdToken) {
            // Token was once valid but has been revoked (sign-out, etc).
            throw new InvalidFirebaseTokenException;
        }

        $claims = $token->claims()->all();

        $name = (string) ($claims['name'] ?? '');
        $firstName = '';
        $lastName = '';
        if ($name !== '') {
            $parts = preg_split('/\s+/', $name, 2);
            $firstName = (string) ($parts[0] ?? '');
            $lastName = (string) ($parts[1] ?? '');
        }

        return new VerifiedFirebaseToken(
            uid: (string) ($claims['sub'] ?? ''),
            email: (string) ($claims['email'] ?? ''),
            emailVerified: (bool) ($claims['email_verified'] ?? false),
            firstName: $firstName,
            lastName: $lastName,
            pictureUrl: isset($claims['picture']) ? (string) $claims['picture'] : null,
        );
    }
}
