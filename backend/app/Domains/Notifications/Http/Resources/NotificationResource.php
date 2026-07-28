<?php

declare(strict_types=1);

namespace App\Domains\Notifications\Http\Resources;

use App\Domains\Users\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class NotificationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $data = array_merge([
            'incident_id' => $this->incident_id,
            'actor_user_id' => null,
            'decision' => null,
            'rejection_reason' => null,
            'expires_at' => null,
            'organization_id' => null,
            'decided_at' => null,
        ], $this->data ?? []);

        return [
            'id' => $this->id,
            'type' => $this->type?->value,
            'message' => $this->message,
            'data' => $data,
            'read' => (bool) $this->read,
            'created_at' => $this->created_at?->toIso8601String(),
            'incident' => $this->whenLoaded('incident', fn () => $this->incident ? [
                'id' => $this->incident->id,
                'title' => $this->incident->title,
            ] : null),
            // Actor: the user who triggered the notification (the operator
            // who claimed / released / resolved the incident, etc.).
            // Looked up by the data->actor_user_id that the observer
            // records when it queues the notification, with fallback to
            // data->claimed_by and data->released_from (older observers
            // only stored the operator ID under those keys). Returns
            // null for legacy rows where the field was never set, or
            // when the referenced user was deleted — the frontend
            // renders a graceful "Sistema" fallback in that case.
            //
            // Note: per-row User::find() is intentional here — the
            // observer records these IDs inside the data jsonb (not as
            // foreign keys), so eager-loading via with() is not
            // available. The cost is N+1 over the page size; with the
            // per-page cap of 200 and ~5ms per lookup, worst case is
            // ~1s on cold cache. Acceptable for the queue use case.
            'actor' => $this->resolveActor(
                $data['actor_user_id'] ?? null,
                $data['claimed_by'] ?? null,
                $data['released_from'] ?? null,
            ),
        ];
    }

    private function resolveActor(?int $actorId, ?int $claimedBy = null, ?int $releasedFrom = null): ?array
    {
        $id = $actorId ?? $claimedBy ?? $releasedFrom;
        if ($id === null || $id <= 0) {
            return null;
        }
        $actor = User::find($id);
        if ($actor === null) {
            return null;
        }
        return [
            'id' => $actor->id,
            'name' => $actor->first_name,
            'role' => $actor->role?->name,
        ];
    }
}
