<?php

declare(strict_types=1);

namespace App\Domains\Auth\Mercure\Services;

use App\Domains\Notifications\Services\NotificationService;
use App\Domains\Users\Models\User;
use Illuminate\Support\Facades\Log;
use Lcobucci\JWT\Configuration;
use Lcobucci\JWT\Signer\Hmac\Sha256;
use Lcobucci\JWT\Signer\Key\InMemory;
use Symfony\Component\HttpFoundation\Cookie;

/**
 * Builds the `mercureAuthorization` cookie that authorizes a browser to
 * subscribe to its own Mercure topic via the app-shell EventSource.
 *
 * Single source of truth for:
 *   - the cookie name (`mercure.cookie.name`) and path
 *   - the TTL (`mercure.cookie.ttl_minutes`, applied to both Max-Age and the JWT `exp` claim)
 *   - the secret used to sign the subscribe JWT (`mercure.subscriber.jwt`)
 *   - the security flags (HttpOnly, SameSite=Strict, Secure when isProduction)
 *   - the `mercure.subscribe` claim shape (currently `["user:{id}:notifications"]`)
 *
 * Both {@see \App\Domains\Auth\Local\Http\Controllers\AuthController} and
 * {@see \App\Domains\Auth\Firebase\Http\Controllers\GoogleAuthController}
 * inject this service and delegate to `build()` (login + refresh) and
 * `expire()` (logout). Future changes — longer TTL, multi-topic claims
 * per role, key rotation hooks — only touch this file.
 */
class MercureCookieService
{
    public const COOKIE_NAME = 'mercureAuthorization';

    public const COOKIE_PATH = '/';

    public const PLACEHOLDER_SECRET = 'insecure-placeholder-configure-MERCURE_SUBSCRIBER_JWT_SECRET';

    /**
     * Build a fresh Mercure authorization cookie for the given user.
     */
    public function build(User $user): Cookie
    {
        $secret = (string) config('mercure.subscriber.jwt');
        if ($secret === '') {
            Log::warning(sprintf(
                '%s is not configured — issuing a placeholder Mercure cookie that the hub will reject.',
                'MERCURE_SUBSCRIBER_JWT_SECRET',
            ));
            $secret = self::PLACEHOLDER_SECRET;
        }

        $jwtConfig = Configuration::forSymmetricSigner(
            new Sha256,
            InMemory::plainText($secret),
        );
        $now = new \DateTimeImmutable;
        $ttlMinutes = (int) config('mercure.cookie.ttl_minutes', 60 * 24 * 30);
        $ttlSeconds = $ttlMinutes * 60;

        $token = $jwtConfig->builder()
            ->issuedAt($now)
            ->expiresAt($now->modify('+'.$ttlSeconds.' seconds'))
            ->withClaim('mercure', ['subscribe' => [NotificationService::topicFor((int) $user->id)]])
            ->getToken($jwtConfig->signer(), $jwtConfig->signingKey());

        return cookie(
            (string) config('mercure.cookie.name', self::COOKIE_NAME),
            $token->toString(),
            $ttlMinutes,
            (string) config('mercure.cookie.path', self::COOKIE_PATH),
            null,
            app()->isProduction(),
            true,
            false,
            'Strict',
        );
    }

    /**
     * Build a Mercure authorization cookie that already expired (used for logout).
     *
     * Reads `mercure.cookie.name` and `mercure.cookie.path` from the same
     * config keys {@see build()} uses — the browser deletes a cookie only
     * when the new Set-Cookie has the exact same name+path+domain. If
     * logout used the default name while login used an overridden one,
     * the original cookie would survive the "logout" for up to its TTL
     * and keep authorizing its subscriber JWT.
     *
     * We use a negative maxAge (-60s) so Laravel writes an Expires
     * timestamp strictly in the past — this matches the framework's
     * {@see \Illuminate\Testing\TestResponse::assertCookieExpired()}
     * assertion and the behavior of the previous in-controller
     * `expiredMercureAuthCookie()` before this service extracted it.
     */
    public function expire(): Cookie
    {
        return cookie(
            (string) config('mercure.cookie.name', self::COOKIE_NAME),
            '',
            -60,
            (string) config('mercure.cookie.path', self::COOKIE_PATH),
            null,
            app()->isProduction(),
            true,
            false,
            'Strict',
        );
    }
}
