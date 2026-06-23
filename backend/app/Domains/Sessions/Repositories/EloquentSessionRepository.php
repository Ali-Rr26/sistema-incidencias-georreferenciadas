<?php

declare(strict_types=1);

namespace App\Domains\Sessions\Repositories;

use App\Domains\Sessions\Domain\Entities\Session as SessionEntity;
use App\Domains\Sessions\Domain\Repositories\SessionRepository;
use App\Domains\Sessions\Models\Session;
use Carbon\Carbon;
use Illuminate\Support\Str;

class EloquentSessionRepository implements SessionRepository
{
    public function create(
        string $userId,
        string $refreshHash,
        ?string $ip,
        ?string $ua,
        Carbon $expiresAt,
        ?string $id = null,
    ): SessionEntity {
        $model = Session::create([
            'id' => $id ?? (string) Str::uuid(),
            'user_id' => $userId,
            'refresh_token_hash' => $refreshHash,
            'ip_address' => $ip,
            'user_agent' => $ua,
            'is_revoked' => false,
            'expires_at' => $expiresAt,
        ]);

        return $this->toEntity($model);
    }

    public function findById(string $id): ?SessionEntity
    {
        $model = Session::with('user')->find($id);

        if ($model === null) {
            return null;
        }

        return $this->toEntity($model);
    }

    public function update(
        string $id,
        string $newHash,
        ?string $ip,
        ?string $ua,
        Carbon $expiresAt,
    ): void {
        $model = Session::findOrFail($id);

        $model->update([
            'refresh_token_hash' => $newHash,
            'ip_address' => $ip,
            'user_agent' => $ua,
            'expires_at' => $expiresAt,
        ]);
    }

    public function revoke(string $id): void
    {
        $model = Session::findOrFail($id);

        $model->update(['is_revoked' => true]);
    }

    private function toEntity(Session $model): SessionEntity
    {
        return new SessionEntity(
            id: $model->id,
            userId: (int) $model->user_id,
            refreshTokenHash: $model->refresh_token_hash,
            ipAddress: $model->ip_address,
            userAgent: $model->user_agent,
            isRevoked: (bool) $model->is_revoked,
            expiresAt: new Carbon($model->expires_at),
            createdAt: new Carbon($model->created_at),
        );
    }
}
