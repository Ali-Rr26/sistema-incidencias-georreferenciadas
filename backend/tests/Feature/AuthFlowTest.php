<?php

declare(strict_types=1);

use App\Domains\Roles\Models\Role;
use App\Domains\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

/**
 * Integration tests for the custom JWT auth flow.
 *
 * Covers login, refresh, logout, me, and middleware scenarios.
 */

uses(RefreshDatabase::class);

beforeEach(function (): void {
    Role::create(['name' => 'Admin']);
});

// ─── Helpers ────────────────────────────────────────────────────────────────────

function createUser(array $overrides = []): User
{
    return User::factory()->create($overrides);
}

function login(User $user, string $password = 'password'): \Illuminate\Testing\TestResponse
{
    return test()->postJson('/api/login', [
        'email' => $user->email,
        'password' => $password,
    ]);
}

// ─── Login ─────────────────────────────────────────────────────────────────────

describe('POST /api/login', function (): void {

    it('returns tokens and user for valid credentials', function (): void {
        $user = createUser();

        $response = login($user);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'access_token',
                'refresh_token',
                'token_type',
                'expires_in',
                'user' => ['id', 'email', 'first_name', 'last_name'],
            ])
            ->assertJson(['token_type' => 'Bearer', 'expires_in' => 900]);
    });

    it('returns 422 for invalid credentials', function (): void {
        $user = createUser();

        $response = test()->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'wrong-password',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    });

    it('returns 422 for missing fields', function (): void {
        $response = test()->postJson('/api/login', []);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email', 'password']);
    });

    it('returns 422 for non-existent user', function (): void {
        $response = test()->postJson('/api/login', [
            'email' => 'nobody@example.com',
            'password' => 'password',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    });
});

// ─── Me (authenticated) ─────────────────────────────────────────────────────────

describe('GET /api/me', function (): void {

    it('returns the authenticated user with role', function (): void {
        $user = createUser();
        $loginResponse = login($user);
        $token = $loginResponse->json('access_token');

        $response = test()->withToken($token)->getJson('/api/me');

        $response->assertStatus(200);
        expect($response->json('email'))->toBe($user->email);
    });

    it('returns 401 without token', function (): void {
        $response = test()->getJson('/api/me');

        $response->assertStatus(401);
    });
});

// ─── Logout ─────────────────────────────────────────────────────────────────────

describe('POST /api/logout', function (): void {

    it('revokes the session and prevents further access', function (): void {
        $user = createUser();
        $loginResponse = login($user);
        $token = $loginResponse->json('access_token');

        // Logout
        $logoutResponse = test()->withToken($token)->postJson('/api/logout');
        $logoutResponse->assertStatus(200)
            ->assertJson(['message' => 'Sesión cerrada exitosamente.']);

        // Attempt to access protected route with the same token
        $retryResponse = test()->withToken($token)->getJson('/api/me');
        $retryResponse->assertStatus(401);
    });

    it('returns 401 when logging out without token', function (): void {
        $response = test()->postJson('/api/logout');
        $response->assertStatus(401);
    });
});

// ─── Refresh ────────────────────────────────────────────────────────────────────

describe('POST /api/auth/refresh', function (): void {

    it('rotates tokens with a valid refresh token', function (): void {
        $user = createUser();
        $loginResponse = login($user);
        $refreshToken = $loginResponse->json('refresh_token');

        $response = test()->postJson('/api/auth/refresh', [
            'refresh_token' => $refreshToken,
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'access_token',
                'refresh_token',
                'token_type',
                'expires_in',
            ])
            ->assertJson(['token_type' => 'Bearer', 'expires_in' => 900]);

        // The new tokens should be different from the old ones
        expect($response->json('access_token'))->not->toBe($loginResponse->json('access_token'));
        expect($response->json('refresh_token'))->not->toBe($refreshToken);

        // The old refresh token should no longer work (rotation)
        $oldRefreshResponse = test()->postJson('/api/auth/refresh', [
            'refresh_token' => $refreshToken,
        ]);
        $oldRefreshResponse->assertStatus(401);
    });

    it('rejects invalid refresh token format', function (): void {
        $response = test()->postJson('/api/auth/refresh', [
            'refresh_token' => 'not-a-valid-jwt',
        ]);

        $response->assertStatus(401);
    });

    it('rejects expired or tampered refresh token', function (): void {
        $response = test()->postJson('/api/auth/refresh', [
            'refresh_token' => 'eyJhbGciOiJIUzI1NiJ9.tampered.abc123',
        ]);

        $response->assertStatus(401);
    });

    it('returns 422 for missing refresh_token', function (): void {
        $response = test()->postJson('/api/auth/refresh', []);
        $response->assertStatus(422);
    });
});

// ─── Middleware Scenarios ───────────────────────────────────────────────────────

describe('JWT middleware', function (): void {

    it('returns 401 without Authorization header', function (): void {
        $response = test()->getJson('/api/me', []);
        $response->assertStatus(401);
    });

    it('returns 401 with malformed Authorization header', function (): void {
        $response = test()->getJson('/api/me', [
            'Authorization' => 'Basic abc123',
        ]);
        $response->assertStatus(401);
    });

    it('returns 401 with invalid Bearer token', function (): void {
        $response = test()->withToken('invalid-token-string')->getJson('/api/me');
        $response->assertStatus(401);
    });

    it('returns 401 with tampered Bearer token', function (): void {
        $response = test()->withToken('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.tampered')->getJson('/api/me');
        $response->assertStatus(401);
    });
});

// ─── E2E: Full Auth Flow ───────────────────────────────────────────────────────

describe('E2E full auth flow', function (): void {

    it('completes login → access protected → refresh → logout cycle', function (): void {
        $user = createUser();

        // 1. Login
        $loginResponse = login($user);
        $loginResponse->assertStatus(200);
        $accessToken = $loginResponse->json('access_token');
        $refreshToken = $loginResponse->json('refresh_token');

        // 2. Access protected route
        $meResponse = test()->withToken($accessToken)->getJson('/api/me');
        $meResponse->assertStatus(200);
        expect($meResponse->json('email'))->toBe($user->email);

        // 3. Refresh tokens
        $refreshResponse = test()->postJson('/api/auth/refresh', [
            'refresh_token' => $refreshToken,
        ]);
        $refreshResponse->assertStatus(200);
        $newAccessToken = $refreshResponse->json('access_token');
        $newRefreshToken = $refreshResponse->json('refresh_token');

        // 4. Old access token still works (not expired, session still active)
        $oldMeResponse = test()->withToken($accessToken)->getJson('/api/me');
        $oldMeResponse->assertStatus(200);

        // 5. New access token works
        $newMeResponse = test()->withToken($newAccessToken)->getJson('/api/me');
        $newMeResponse->assertStatus(200);

        // 6. Logout
        $logoutResponse = test()->withToken($newAccessToken)->postJson('/api/logout');
        $logoutResponse->assertStatus(200);

        // 7. After logout, the same token no longer works
        $afterLogout = test()->withToken($newAccessToken)->getJson('/api/me');
        $afterLogout->assertStatus(401);
    });
});
