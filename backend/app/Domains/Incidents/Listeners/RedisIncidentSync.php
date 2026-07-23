<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Listeners;

use App\Console\Commands\FeedRebuildCommand;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Incidents\ReadModels\IncidentFeedSerializer;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;

/**
 * Proyector que mantiene sincronizado el read model Redis con Postgres.
 *
 * @cqrs-role projection-listener
 *
 * Pertenece a la frontera write→read: escucha los eventos Eloquent
 * `created` / `updated` / `deleted` / `forceDeleted` que dispara el modelo
 * Incident y reescribe los hashes en Redis (feed:v2:items + feed:v2:index).
 *
 * El shape del payload en Redis lo define {@see IncidentFeedSerializer} y es
 * la fuente única de verdad: este listener y {@see FeedRebuildCommand}
 * lo consumen vía inyección. Si agregás un campo, tocás el serializer — y los
 * dos sitios que escriben a Redis lo reflejan automáticamente. No hay shape
 * duplicado en este archivo.
 *
 * No es event sourcing: si Redis se pierde, los datos se reconstruyen
 * desde Postgres con un job de re-proyección, no desde un log de eventos.
 *
 * @see docs/Convenciones/architecture-cqrs-lite.md
 */
class RedisIncidentSync
{
    public function __construct(
        private readonly IncidentFeedSerializer $serializer,
    ) {}

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
            $data = $this->serializer->serialize($incident);

            Redis::hset(self::V2_ITEMS_KEY, (string) $incident->id, json_encode($data));
            Redis::zadd(self::V2_INDEX_KEY, (float) $incident->created_at->timestamp, (string) $incident->id);

            $feedTtlSeconds = (int) config('cache.feed_ttl_seconds');
            Redis::expire(self::V2_ITEMS_KEY, $feedTtlSeconds);
            Redis::expire(self::V2_INDEX_KEY, $feedTtlSeconds);
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
