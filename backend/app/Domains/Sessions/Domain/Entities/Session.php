<?php

declare(strict_types=1);

namespace App\Domains\Sessions\Domain\Entities;

use Carbon\Carbon;

class Session
{
    public function __construct(
        private readonly string $id,
        private readonly int $userId,
        private readonly string $refreshTokenHash,
        private readonly ?string $ipAddress,
        private readonly ?string $userAgent,
        private readonly bool $isRevoked,
        private readonly Carbon $expiresAt,
        private readonly Carbon $createdAt,
    ) {}

    public function getId(): string
    {
        return $this->id;
    }

    public function getUserId(): int
    {
        return $this->userId;
    }

    public function getRefreshTokenHash(): string
    {
        return $this->refreshTokenHash;
    }

    public function getIpAddress(): ?string
    {
        return $this->ipAddress;
    }

    public function getUserAgent(): ?string
    {
        return $this->userAgent;
    }

    public function isRevoked(): bool
    {
        return $this->isRevoked;
    }

    public function getExpiresAt(): Carbon
    {
        return $this->expiresAt;
    }

    public function getCreatedAt(): Carbon
    {
        return $this->createdAt;
    }

    public function isValid(): bool
    {
        return ! $this->isRevoked && $this->expiresAt->isFuture();
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->userId,
            'refresh_token_hash' => $this->refreshTokenHash,
            'ip_address' => $this->ipAddress,
            'user_agent' => $this->userAgent,
            'is_revoked' => $this->isRevoked,
            'expires_at' => $this->expiresAt->toDateTimeString(),
            'created_at' => $this->createdAt->toDateTimeString(),
        ];
    }
}
