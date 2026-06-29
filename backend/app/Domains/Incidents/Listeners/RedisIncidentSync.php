<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Listeners;

use App\Domains\Incidents\Models\Incident;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;

class RedisIncidentSync
{
    private const SORTED_SET_KEY = 'feed:incidents';

    private const HASH_PREFIX = 'incident:';

    public function created(Incident $incident): void
    {
        $this->syncIncident($incident);
    }

    public function updated(Incident $incident): void
    {
        $this->syncIncident($incident);
    }

    public function deleted(Incident $incident): void
    {
        $this->removeIncident($incident);
    }

    public function forceDeleted(Incident $incident): void
    {
        $this->removeIncident($incident);
    }

    private function syncIncident(Incident $incident): void
    {
        try {
            $incident->loadMissing(['category.organizations', 'location', 'user']);

            $locationPathIds = $incident->location?->ancestorsAndSelf()
                ->orderBy('depth', 'desc')
                ->pluck('id')
                ->toArray() ?? [];

            $data = [
                'id' => (string) $incident->id,
                'incident_category_id' => (string) $incident->incident_category_id,
                'organization_id' => (string) $incident->organization_id,
                'user_id' => (string) $incident->user_id,
                'location_id' => (string) $incident->location_id,
                'status' => $incident->status,
                'priority' => $incident->priority,
                'resolution_date' => $incident->resolution_date?->toIso8601String(),
                'created_at' => $incident->created_at?->toIso8601String(),
                'updated_at' => $incident->updated_at?->toIso8601String(),
                'geom' => $incident->geom ? $incident->geom->toJson() : null,
                'category_name' => $incident->category?->name ?? '',
                'category_organizations' => json_encode(
                    $incident->category?->organizations?->map(fn ($o) => ['id' => $o->id, 'name' => $o->name]) ?? [],
                ),
                'organization_name' => $incident->organization?->name ?? '',
                'location_name' => $incident->location?->name ?? '',
                'location_path_ids' => json_encode($locationPathIds),
                'user_first_name' => $incident->user?->first_name,
                'user_last_name' => $incident->user?->last_name,
                'user_avatar' => $incident->user?->avatar,
            ];

            Redis::hmset(self::HASH_PREFIX.$incident->id, $data);
            Redis::zadd(self::SORTED_SET_KEY, (float) $incident->created_at->timestamp, (string) $incident->id);
        } catch (\Throwable $e) {
            Log::warning('Failed to sync incident to Redis', [
                'incident_id' => $incident->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function removeIncident(Incident $incident): void
    {
        try {
            Redis::del(self::HASH_PREFIX.$incident->id);
            Redis::zrem(self::SORTED_SET_KEY, (string) $incident->id);
        } catch (\Throwable $e) {
            Log::warning('Failed to remove incident from Redis', [
                'incident_id' => $incident->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
