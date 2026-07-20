<?php

declare(strict_types=1);

namespace App\Domains\Incidents\ReadModels;

use App\Domains\Incidents\Models\Incident;

/**
 * Fuente única de verdad del shape que el read model Redis espera por Incidencia.
 *
 * Si modificás este método, también tenés que actualizar {@see \App\Domains\Incidents\Http\FeedController}
 * / {@see \App\Domains\Incidents\Models\FeedService} si consumen los campos nuevos — pero el SERIALIZER
 * es lo único que {@see \App\Domains\Incidents\Listeners\RedisIncidentSync} y
 * {@see \App\Console\Commands\FeedRebuildCommand} usan para escribir. Antes de este extractor, el
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
        ];
    }
}
