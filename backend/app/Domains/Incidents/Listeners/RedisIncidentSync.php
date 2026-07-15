<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Listeners;

use App\Domains\Incidents\Models\Incident;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;

class RedisIncidentSync
{
    private const V2_INDEX_KEY = 'feed:v2:index';

    private const V2_ITEMS_KEY = 'feed:v2:items';

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
            $incident->loadMissing(['category', 'location', 'user']);

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
                'title' => $incident->title,
                'status' => $incident->status,
                'priority' => $incident->priority,
                'resolution_date' => $incident->resolution_date?->toIso8601String(),
                'created_at' => $incident->created_at?->toIso8601String(),
                'updated_at' => $incident->updated_at?->toIso8601String(),
                'geom' => $incident->geom ? $incident->geom->toJson() : null,
                'category_name' => $incident->category?->name ?? '',
                'organization_name' => $incident->organization?->name ?? '',
                'location_name' => $incident->location?->name ?? '',
                'location_path_ids' => json_encode($locationPathIds),
                'user_first_name' => $incident->user?->first_name,
                'user_last_name' => $incident->user?->last_name,
                'user_avatar' => $incident->user?->avatar,
            ];

            Redis::hset(self::V2_ITEMS_KEY, (string) $incident->id, json_encode($data));
            Redis::zadd(self::V2_INDEX_KEY, (float) $incident->created_at->timestamp, (string) $incident->id);
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
            Redis::hdel(self::V2_ITEMS_KEY, (string) $incident->id);
            Redis::zrem(self::V2_INDEX_KEY, (string) $incident->id);
        } catch (\Throwable $e) {
            Log::warning('Failed to remove incident from Redis', [
                'incident_id' => $incident->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
