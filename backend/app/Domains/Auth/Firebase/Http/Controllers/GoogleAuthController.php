<?php

declare(strict_types=1);

namespace App\Domains\Auth\Firebase\Http\Controllers;

use App\Domains\Auth\Firebase\Exceptions\InvalidFirebaseTokenException;
use App\Domains\Auth\Firebase\Exceptions\RejectedUnverifiedException;
use App\Domains\Auth\Firebase\Http\Requests\GoogleLoginRequest;
use App\Domains\Auth\Firebase\Services\GoogleAuthService;
use App\Domains\Auth\Shared\Exceptions\AuthenticationException;
use App\Domains\Notifications\Services\NotificationService;
use App\Domains\Users\Http\Resources\UserResource;
use App\Domains\Users\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Lcobucci\JWT\Configuration;
use Lcobucci\JWT\Signer\Hmac\Sha256;
use Lcobucci\JWT\Signer\Key\InMemory;
use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\HttpFoundation\Response;

class GoogleAuthController
{
    private const REFRESH_COOKIE = 'refresh_token';

    private const COOKIE_PATH = '/api/auth';

    private const COOKIE_MINUTES = 60 * 24 * 30; // 30 días

    private const ACCESS_TTL = 900;

    private const MERCURE_COOKIE = 'mercureAuthorization';

    public function __construct(
        private readonly GoogleAuthService $googleAuthService,
    ) {}

    public function login(GoogleLoginRequest $request): JsonResponse
    {
        try {
            $result = $this->googleAuthService->login(
                idToken: $request->validated()['id_token'],
                ip: $request->ip(),
                ua: $request->userAgent(),
            );
        } catch (InvalidFirebaseTokenException|RejectedUnverifiedException $e) {
            if ($e instanceof RejectedUnverifiedException) {
                Log::warning('auth.google.rejected_unverified', [
                    'ip' => $request->ip(),
                ]);
            } else {
                Log::warning('auth.google.token_invalid', [
                    'ip' => $request->ip(),
                ]);
            }

            return response()->json($e->toResponse(), Response::HTTP_UNAUTHORIZED);
        } catch (AuthenticationException $e) {
            return response()->json($e->toResponse(), Response::HTTP_UNAUTHORIZED);
        }

        /** @var User $user */
        $user = $result['user'];

        return response()->json([
            'access_token' => $result['accessToken'],
            'token_type' => 'Bearer',
            'expires_in' => self::ACCESS_TTL,
            'user' => new UserResource($user),
        ])
            ->withCookie($this->refreshCookie($result['refreshToken']))
            ->withCookie($this->mercureAuthCookie($user));
    }

    // Cookie builders

    private function refreshCookie(string $token): Cookie
    {
        return cookie(
            self::REFRESH_COOKIE,
            $token,
            self::COOKIE_MINUTES,
            self::COOKIE_PATH,
            null,
            app()->isProduction(),
            true,
            false,
            'Strict',
        );
    }

    private function mercureAuthCookie(User $user): Cookie
    {
        $secret = (string) config('octane.mercure.subscriber_jwt');
        if ($secret === '') {
            Log::warning('MERCURE_SUBSCRIBER_JWT_SECRET is not configured — issuing a placeholder Mercure cookie that the hub will reject.');

            $secret = 'insecure-placeholder-configure-MERCURE_SUBSCRIBER_JWT_SECRET';
        }

        $config = Configuration::forSymmetricSigner(
            new Sha256,
            InMemory::plainText($secret),
        );
        $now = new \DateTimeImmutable;

        $token = $config->builder()
            ->issuedAt($now)
            ->expiresAt($now->modify('+'.self::ACCESS_TTL.' seconds'))
            ->withClaim('mercure', ['subscribe' => [NotificationService::topicFor($user->id)]])
            ->getToken($config->signer(), $config->signingKey());

        return cookie(
            self::MERCURE_COOKIE,
            $token->toString(),
            (int) (self::ACCESS_TTL / 60),
            '/',
            null,
            app()->isProduction(),
            true,
            false,
            'Strict',
        );
    }
}
