<?php

declare(strict_types=1);

namespace App\Domains\Auth\Local\Http\Controllers;

use App\Domains\Auth\Local\Exceptions\PendingInvitationException;
use App\Domains\Auth\Local\Http\Requests\LoginRequest;
use App\Domains\Auth\Local\Http\Requests\UpdateProfileRequest;
use App\Domains\Auth\Shared\Exceptions\AuthenticationException;
use App\Domains\Auth\Shared\Services\AuthService;
use App\Domains\Users\Http\Resources\UserResource;
use App\Domains\Users\Services\ProfileImageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\HttpFoundation\Response;

class AuthController
{
    private const REFRESH_COOKIE = 'refresh_token';

    private const COOKIE_PATH = '/api/auth';

    private const COOKIE_MINUTES = 60 * 24 * 30; // 30 días

    private const ACCESS_TTL = 900;

    public function __construct(
        private readonly AuthService $authService,
        private readonly ProfileImageService $profileImageService,
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
        } catch (PendingInvitationException $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], Response::HTTP_UNAUTHORIZED);
        } catch (AuthenticationException $e) {
            throw $e->toValidationException();
        }

        return response()->json([
            'access_token' => $result['accessToken'],
            'token_type' => 'Bearer',
            'expires_in' => self::ACCESS_TTL,
            'user' => new UserResource($result['user']),
        ])
            ->withCookie($this->refreshCookie($result['refreshToken']));
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
            ->withCookie($this->refreshCookie($result['refreshToken']));
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
            ->withCookie($this->expiredCookie());
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
     *
     * Dual-mode:
     * - JSON (application/json): accepts avatar as { urls: [...] } legacy object.
     * - Multipart (multipart/form-data): accepts avatar as an uploaded file.
     */
    public function updateProfile(UpdateProfileRequest $request): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validated();

        // Handle password hashing (never mass-assign raw password)
        if (array_key_exists('password', $validated)) {
            if ($validated['password'] !== null && $validated['password'] !== '') {
                $validated['password'] = Hash::make($validated['password']);
            } else {
                unset($validated['password']);
            }
        }

        // Handle avatar file upload via ProfileImageService
        if ($request->hasFile('avatar')) {
            $newPath = $this->profileImageService->replaceAvatar($user, $request->file('avatar'));
            $validated['profile_image_path'] = $newPath;
            // Remove legacy avatar array from text update — file upload replaces it
            unset($validated['avatar']);
        }

        // Update text fields
        if ($validated !== []) {
            $user->update($validated);
        }

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
}
