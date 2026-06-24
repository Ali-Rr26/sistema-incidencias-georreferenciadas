<?php

declare(strict_types=1);

use App\Domains\Sessions\Domain\Entities\Session;
use Carbon\Carbon;

/**
 * Unit tests for the Session value object.
 */

beforeEach(function (): void {
    $this->future = Carbon::now()->addDays(1);
    $this->past = Carbon::now()->subDays(1);
    $this->now = Carbon::now();
});

it('creates a session entity with all fields', function (): void {
    $session = new Session(
        id: 'uuid-123',
        userId: 42,
        refreshTokenHash: '$2y$12$hashedvalue',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        isRevoked: false,
        expiresAt: $this->future,
        createdAt: $this->now,
    );

    expect($session->getId())->toBe('uuid-123');
    expect($session->getUserId())->toBe(42);
    expect($session->getRefreshTokenHash())->toBe('$2y$12$hashedvalue');
    expect($session->getIpAddress())->toBe('192.168.1.1');
    expect($session->getUserAgent())->toBe('Mozilla/5.0');
    expect($session->isRevoked())->toBeFalse();
});

it('allows nullable ip and user agent', function (): void {
    $session = new Session(
        id: 'uuid-456',
        userId: 1,
        refreshTokenHash: 'hash',
        ipAddress: null,
        userAgent: null,
        isRevoked: false,
        expiresAt: $this->future,
        createdAt: $this->now,
    );

    expect($session->getIpAddress())->toBeNull();
    expect($session->getUserAgent())->toBeNull();
});

it('is valid when not revoked and not expired', function (): void {
    $session = new Session(
        id: 'uuid-valid',
        userId: 1,
        refreshTokenHash: 'hash',
        ipAddress: null,
        userAgent: null,
        isRevoked: false,
        expiresAt: $this->future,
        createdAt: $this->now,
    );

    expect($session->isValid())->toBeTrue();
});

it('is invalid when revoked', function (): void {
    $session = new Session(
        id: 'uuid-revoked',
        userId: 1,
        refreshTokenHash: 'hash',
        ipAddress: null,
        userAgent: null,
        isRevoked: true,
        expiresAt: $this->future,
        createdAt: $this->now,
    );

    expect($session->isValid())->toBeFalse();
});

it('is invalid when expired', function (): void {
    $session = new Session(
        id: 'uuid-expired',
        userId: 1,
        refreshTokenHash: 'hash',
        ipAddress: null,
        userAgent: null,
        isRevoked: false,
        expiresAt: $this->past,
        createdAt: $this->now,
    );

    expect($session->isValid())->toBeFalse();
});

it('is invalid when revoked and expired', function (): void {
    $session = new Session(
        id: 'uuid-both',
        userId: 1,
        refreshTokenHash: 'hash',
        ipAddress: null,
        userAgent: null,
        isRevoked: true,
        expiresAt: $this->past,
        createdAt: $this->now,
    );

    expect($session->isValid())->toBeFalse();
});

it('converts to array', function (): void {
    $session = new Session(
        id: 'uuid-arr',
        userId: 7,
        refreshTokenHash: 'hash123',
        ipAddress: '10.0.0.1',
        userAgent: 'curl/8',
        isRevoked: false,
        expiresAt: $this->future,
        createdAt: $this->now,
    );

    $array = $session->toArray();

    expect($array['id'])->toBe('uuid-arr');
    expect($array['user_id'])->toBe(7);
    expect($array['refresh_token_hash'])->toBe('hash123');
    expect($array['ip_address'])->toBe('10.0.0.1');
    expect($array['user_agent'])->toBe('curl/8');
    expect($array['is_revoked'])->toBeFalse();
    expect($array['expires_at'])->toBe($this->future->toDateTimeString());
    expect($array['created_at'])->toBe($this->now->toDateTimeString());
});
