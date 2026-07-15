<?php

declare(strict_types=1);

namespace App\Domains\Auth\Local\Http\Controllers;

use App\Domains\Auth\Local\Http\Requests\LoginRequest;
use App\Domains\Auth\Shared\Exceptions\AuthenticationException;
use App\Domains\Auth\Shared\Services\AuthService;
use App\Domains\Notifications\Services\NotificationService;
use App\Domains\Users\Http\Resources\UserResource;
use App\Domains\Users\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Lcobucci\JWT\Configuration;
use Lcobucci\JWT\Signer\Hmac\Sha256;
use Lcobucci\JWT\Signer\Key\InMemory;
use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\HttpFoundation\Response;

class AuthController
{
    private const REFRESH_COOKIE = 'refresh_token';

    private const COOKIE_PATH = '/api/auth';

    private const COOKIE_MINUTES = 60 * 24 * 30; // 30 días

    private const ACCESS_TTL = 900;

    private const MERCURE_COOKIE = 'mercureAuthorization';

    public function __construct(
        private readonly AuthService $authService,
    ) {}

    /**
     * POST /api/login
     */
    public function login(LoginRequest $request): JsonResponse
    {
        try {
            $result = $this->authService->login(
                email: $request->validated()['email'],
                password: $request->validated()['password'],
                ip: $request->ip(),
                ua: $request->userAgent(),
            );
        } catch (AuthenticationException $e) {
            throw $e->toValidationException();
        }

        return response()->json([
            'access_token' => $result['accessToken'],
            'token_type' => 'Bearer',
            'expires_in' => self::ACCESS_TTL,
            'user' => new UserResource($result['user']),
        ])
            ->withCookie($this->refreshCookie($result['refreshToken']))
            ->withCookie($this->mercureAuthCookie($result['user']));
    }

    /**
     * POST /api/auth/refresh
     */
    public function refresh(Request $request): JsonResponse
    {
        try {
            $result = $this->authService->refresh(
                refreshToken: $request->cookie(self::REFRESH_COOKIE) ?? '',
                ip: $request->ip(),
                ua: $request->userAgent(),
            );
        } catch (AuthenticationException $e) {
            return response()->json(
                $e->toResponse(),
                Response::HTTP_UNAUTHORIZED,
            );
        }

        return response()->json([
            'access_token' => $result['accessToken'],
            'token_type' => 'Bearer',
            'expires_in' => self::ACCESS_TTL,
        ])
            ->withCookie($this->refreshCookie($result['refreshToken']))
            ->withCookie($this->mercureAuthCookie($result['user']));
    }

    /**
     * POST /api/logout
     */
    public function logout(Request $request): JsonResponse
    {
        $sessionId = $request->input('_session_id');

        if ($sessionId !== null) {
            $this->authService->revokeSession($sessionId);
        }

        return response()->json([
            'message' => 'Sesión cerrada exitosamente.',
        ])
            ->withCookie($this->expiredCookie())
            ->withCookie($this->expiredMercureAuthCookie());
    }

    /**
     * GET /api/me
     */
    public function me(Request $request): JsonResponse
    {
        return response()->json(
            new UserResource($request->user()->load('role')),
        );
    }

    /**
     * PUT /api/auth/profile
     */
    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user === null) {
            return response()->json(['message' => 'No autenticado'], Response::HTTP_UNAUTHORIZED);
        }

        $validated = $request->validate([
            'first_name' => 'sometimes|string|max:100',
            'last_name' => 'sometimes|string|max:100',
            'phone' => 'sometimes|nullable|string|max:50',
            'password' => 'sometimes|nullable|string|min:8',
            'avatar' => ['sometimes', 'array'],
            'avatar.urls' => Rule::when(
                $request->has('avatar.urls'),
                ['array', 'max:5'],
            ),
            'avatar.urls.*' => Rule::when(
                $request->has('avatar.urls'),
                ['string', 'url'],
            ),
        ]);

        if (array_key_exists('password', $validated)) {
            if ($validated['password'] !== null && $validated['password'] !== '') {
                $validated['password'] = Hash::make($validated['password']);
            } else {
                unset($validated['password']);
            }
        }

        $user->update($validated);

        return response()->json(
            new UserResource($user->load(['role', 'organization'])),
        );
    }

    /**
     * Build HttpOnly cookie with the refresh token.
     */
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

    /**
     * Build cookie that expires immediately (for logout).
     */
    private function expiredCookie(): Cookie
    {
        return cookie(
            self::REFRESH_COOKIE,
            '',
            -60,
            self::COOKIE_PATH,
            null,
            app()->isProduction(),
            true,
            false,
            'Strict',
        );
    }

    /**
     * Build the Mercure subscriber authorization cookie for this user.
     */
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

    /**
     * Build Mercure authorization cookie that expires immediately (logout).
     */
    private function expiredMercureAuthCookie(): Cookie
    {
        return cookie(
            self::MERCURE_COOKIE,
            '',
            -60,
            '/',
            null,
            app()->isProduction(),
            true,
            false,
            'Strict',
        );
    }
}
