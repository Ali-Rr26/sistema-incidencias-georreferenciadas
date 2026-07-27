<?php

declare(strict_types=1);

namespace App\Domains\Incidents\ReadModels;

use App\Console\Commands\FeedRebuildCommand;
use App\Domains\Incidents\Http\FeedController;
use App\Domains\Incidents\Listeners\RedisIncidentSync;
use App\Domains\Incidents\Models\FeedService;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Incidents\Models\IncidentDuplicate;
use App\Domains\Incidents\Models\IncidentFollower;
use App\Domains\Incidents\Models\MeTooReport;

/**
 * Fuente única de verdad del shape que el read model Redis espera por Incidencia.
 *
 * Si modificás este método, también tenés que actualizar {@see FeedController}
 * / {@see FeedService} si consumen los campos nuevos — pero el SERIALIZER
 * es lo único que {@see RedisIncidentSync} y
 * {@see FeedRebuildCommand} usan para escribir. Antes de este extractor, el
 * shape estaba duplicado en esos dos sitios y un cambio silencioso en uno degradaba el feed
 * sin que el otro se enterara (versión live vs versión rebuild quedaban desincronizadas).
 */
final class IncidentFeedSerializer
{
    /**
     * Serializa una Incidencia al array que se persiste en Redis como `feed:v2:items`.
     *
     * @return array<string, mixed>
     */
    public function serialize(Incident $incident): array
    {
        // Eager-load defensivo: si el llamador no hizo ->with([...]) los relations
        // vienen null, y queremos que el shape sea estable aunque se invoque con
        // un Incident "pelado" (ej. un test).
        $incident->loadMissing(['category', 'location', 'user']);

        $locationPathIds = $incident->location?->ancestorsAndSelf()
            ->orderBy('depth', 'desc')
            ->pluck('id')
            ->toArray() ?? [];

        // Counters cached on the read model. The live projection (HINCRBY
        // in MeTooController / IncidentFollowerController / IncidentDuplicateController)
        // is the source for the per-event increment, but the bootstrap / rebuild
        // path computes these from Postgres directly so the read model can be
        // rebuilt from scratch without relying on the increment log.
        return [
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
            'comment_count' => $this->countComments($incident),
            'me_too_count' => $this->countMeToo($incident),
            'followers_count' => $this->countFollowers($incident),
            'duplicates_count' => $this->countDuplicates($incident),
            'is_duplicate' => $this->isDuplicate($incident),
        ];
    }

    /**
     * The comment count is ALSO maintained via HINCRBY on the
     * `incident:{id}` hash by SyncCommentToRedisJob. The serializer
     * version below is read-only and uses the relation's loaded count
     * when present, falling back to a count query otherwise.
     */
    private function countComments(Incident $incident): int
    {
        if (array_key_exists('comments_count', $incident->getAttributes())) {
            return (int) $incident->getAttribute('comments_count');
        }

        return (int) $incident->comments()->count();
    }

    private function countMeToo(Incident $incident): int
    {
        if (array_key_exists('me_too_count', $incident->getAttributes())) {
            return (int) $incident->getAttribute('me_too_count');
        }

        return (int) MeTooReport::query()
            ->where('incident_id', $incident->id)
            ->count();
    }

    private function countFollowers(Incident $incident): int
    {
        if (array_key_exists('followers_count', $incident->getAttributes())) {
            return (int) $incident->getAttribute('followers_count');
        }

        return (int) IncidentFollower::query()
            ->where('incident_id', $incident->id)
            ->count();
    }

    private function countDuplicates(Incident $incident): int
    {
        if (array_key_exists('duplicates_count', $incident->getAttributes())) {
            return (int) $incident->getAttribute('duplicates_count');
        }

        return (int) IncidentDuplicate::query()
            ->where('original_incident_id', $incident->id)
            ->where('status', 'confirmed')
            ->count();
    }

    private function isDuplicate(Incident $incident): bool
    {
        if (array_key_exists('is_duplicate', $incident->getAttributes())) {
            return (bool) $incident->getAttribute('is_duplicate');
        }

        return IncidentDuplicate::query()
            ->where('duplicate_incident_id', $incident->id)
            ->where('status', 'confirmed')
            ->exists();
    }
}
