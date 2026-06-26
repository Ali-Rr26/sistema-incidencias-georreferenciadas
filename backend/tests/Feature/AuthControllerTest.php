<?php

declare(strict_types=1);

use App\Domains\Auth\Services\AuthService;
use App\Domains\Users\Models\User;
use Mockery\MockInterface;

it('logs in and returns access tokens plus the user payload', function (): void {
    $user = User::factory()->make([
        'email' => 'admin@example.com',
        'first_name' => 'Admin',
        'last_name' => 'User',
        'phone' => '0999999999',
    ]);
    $user->forceFill(['id' => 15]);

    $this->mock(AuthService::class, function (MockInterface $mock) use ($user): void {
        $mock->shouldReceive('login')
            ->once()
            ->andReturn([
                'accessToken' => 'access-token-1',
                'refreshToken' => 'refresh-token-1',
                'user' => $user,
            ]);
    });

    $response = $this->postJson('/api/login', [
        'email' => 'admin@example.com',
        'password' => 'secret-password',
    ]);

    $response->assertOk()
        ->assertJson([
            'access_token' => 'access-token-1',
            'token_type' => 'Bearer',
            'expires_in' => 900,
            'user' => [
                'id' => 15,
                'email' => 'admin@example.com',
                'first_name' => 'Admin',
                'last_name' => 'User',
                'phone' => '0999999999',
            ],
        ])
        ->assertCookie('refresh_token');
});

it('validates login payload before touching the auth service', function (): void {
    $response = $this->postJson('/api/login', []);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['email', 'password']);
});

it('refreshes the access token from the refresh cookie', function (): void {
    $this->mock(AuthService::class, function (MockInterface $mock): void {
        $mock->shouldReceive('refresh')
            ->once()
            ->withArgs(function (string $refreshToken, ?string $ip, ?string $ua): bool {
                return $refreshToken !== '';
            })
            ->andReturn([
                'accessToken' => 'access-token-2',
                'refreshToken' => 'refresh-token-2',
            ]);
    });

    $response = $this->withoutMiddleware(\Illuminate\Cookie\Middleware\EncryptCookies::class)
        ->withCookie('refresh_token', 'refresh-token-1')
        ->post('/api/auth/refresh');

    $response->assertOk()
        ->assertJson([
            'access_token' => 'access-token-2',
            'token_type' => 'Bearer',
            'expires_in' => 900,
        ])
        ->assertCookie('refresh_token');
});

it('logs out and revokes the current session when provided', function (): void {
    $this->mock(AuthService::class, function (MockInterface $mock): void {
        $mock->shouldReceive('revokeSession')
            ->once()
            ->with('session-123');
    });

    $response = $this->withoutMiddleware()->postJson('/api/logout', [
        '_session_id' => 'session-123',
    ]);

    $response->assertOk()
        ->assertJson([
            'message' => 'Sesión cerrada exitosamente.',
        ])
        ->assertCookieExpired('refresh_token');
});
