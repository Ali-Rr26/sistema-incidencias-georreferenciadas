<?php

declare(strict_types=1);

use App\Domains\Invitations\Models\UserInvitation;
use App\Domains\Invitations\Services\InvitationTokenGenerator;
use App\Domains\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    DB::table('roles')->insert(['id' => 1, 'name' => 'admin_sistema']);
});

it('accepts invitation via HTTP with valid token and payload', function (): void {
    $user = User::factory()->create();
    $tokenGen = app(InvitationTokenGenerator::class);
    ['tokenPlain' => $tokenPlain, 'tokenHash' => $tokenHash] = $tokenGen->generate();

    UserInvitation::create([
        'user_id' => $user->id,
        'token_hash' => $tokenHash,
        'expires_at' => now()->addHours(48),
        'terms_version' => 'v0',
    ]);

    $response = $this->postJson("/api/invitations/{$tokenPlain}/accept", [
        'password' => 'ValidPass1',
        'password_confirmation' => 'ValidPass1',
        'accept_terms' => true,
        'terms_version' => 'v0',
    ]);

    $response->assertOk()
        ->assertJson(['message' => 'Cuenta activada']);
});

it('returns 404 for nonexistent token via HTTP', function (): void {
    $response = $this->postJson('/api/invitations/nonexistent-token-plaintext-64-chars-xxx/accept', [
        'password' => 'ValidPass1',
        'password_confirmation' => 'ValidPass1',
        'accept_terms' => true,
        'terms_version' => 'v0',
    ]);

    $response->assertNotFound();
});

it('returns 422 when accept_terms is false via HTTP', function (): void {
    $user = User::factory()->create();
    $tokenGen = app(InvitationTokenGenerator::class);
    ['tokenPlain' => $tokenPlain, 'tokenHash' => $tokenHash] = $tokenGen->generate();

    UserInvitation::create([
        'user_id' => $user->id,
        'token_hash' => $tokenHash,
        'expires_at' => now()->addHours(48),
        'terms_version' => 'v0',
    ]);

    $response = $this->postJson("/api/invitations/{$tokenPlain}/accept", [
        'password' => 'ValidPass1',
        'password_confirmation' => 'ValidPass1',
        'accept_terms' => false,
        'terms_version' => 'v0',
    ]);

    $response->assertUnprocessable()
        ->assertJsonValidationErrors(['accept_terms']);
});

it('returns 422 when password is weak via HTTP', function (): void {
    $user = User::factory()->create();
    $tokenGen = app(InvitationTokenGenerator::class);
    ['tokenPlain' => $tokenPlain, 'tokenHash' => $tokenHash] = $tokenGen->generate();

    UserInvitation::create([
        'user_id' => $user->id,
        'token_hash' => $tokenHash,
        'expires_at' => now()->addHours(48),
        'terms_version' => 'v0',
    ]);

    $response = $this->postJson("/api/invitations/{$tokenPlain}/accept", [
        'password' => 'weakpass',
        'password_confirmation' => 'weakpass',
        'accept_terms' => true,
        'terms_version' => 'v0',
    ]);

    $response->assertUnprocessable()
        ->assertJsonValidationErrors(['password']);
});

it('returns 410 when invitation is already consumed via HTTP', function (): void {
    $user = User::factory()->create();
    $tokenGen = app(InvitationTokenGenerator::class);
    ['tokenPlain' => $tokenPlain, 'tokenHash' => $tokenHash] = $tokenGen->generate();

    UserInvitation::create([
        'user_id' => $user->id,
        'token_hash' => $tokenHash,
        'expires_at' => now()->addHours(48),
        'accepted_at' => now()->subMinute(),
        'terms_version' => 'v0',
    ]);

    $response = $this->postJson("/api/invitations/{$tokenPlain}/accept", [
        'password' => 'ValidPass1',
        'password_confirmation' => 'ValidPass1',
        'accept_terms' => true,
        'terms_version' => 'v0',
    ]);

    $response->assertStatus(410)
        ->assertJson(['message' => 'Invitación ya utilizada']);
});

it('is rate limited: 11th request returns 429', function (): void {
    $user = User::factory()->create();
    $tokenGen = app(InvitationTokenGenerator::class);
    ['tokenPlain' => $tokenPlain, 'tokenHash' => $tokenHash] = $tokenGen->generate();

    UserInvitation::create([
        'user_id' => $user->id,
        'token_hash' => $tokenHash,
        'expires_at' => now()->addHours(48),
        'terms_version' => 'v0',
    ]);

    // Make 10 requests (limit is 10/min)
    for ($i = 0; $i < 10; $i++) {
        $this->postJson("/api/invitations/{$tokenPlain}/accept", [
            'password' => 'ValidPass1',
            'password_confirmation' => 'ValidPass1',
            'accept_terms' => true,
            'terms_version' => 'v0',
        ]);
    }

    // 11th request should be rate limited
    $response = $this->postJson("/api/invitations/{$tokenPlain}/accept", [
        'password' => 'ValidPass1',
        'password_confirmation' => 'ValidPass1',
        'accept_terms' => true,
        'terms_version' => 'v0',
    ]);

    $response->assertStatus(429);
});
