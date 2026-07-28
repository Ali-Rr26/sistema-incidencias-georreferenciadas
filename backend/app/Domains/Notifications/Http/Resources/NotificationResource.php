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
            //
            // WU4 (PR-2): the observer snapshots `data.actor_name` (the
            // user's full display name) at creation time, so the resource
            // resolves the actor WITHOUT a per-row `User::find()`. A page
            // of 50 notifications no longer costs 50 extra queries.
            //
            // Fallback chain:
            //   1. data.actor_name present  → use it directly (no DB hit).
            //   2. data.actor_user_id set but actor_name absent → legacy
            //      path: `User::find()` to fetch the current first_name +
            //      role. Covers rows written before the observer started
            //      snapshotting actor_name.
            //   3. otherwise (no actor at all) → null; frontend renders
            //      a graceful "Sistema" fallback.
            //
            // id resolution also accepts the older `data->claimed_by` /
            // `data->released_from` keys so notifications produced by the
            // pre-S-3 observer layer still resolve to a user.
            'actor' => $this->resolveActor(
                $data['actor_user_id'] ?? null,
                $data['actor_name'] ?? null,
                $data['actor_role'] ?? null,
                $data['claimed_by'] ?? null,
                $data['released_from'] ?? null,
            ),
        ];
    }

private function resolveActor(
            ?int $actorId,
            ?string $actorName = null,
            ?string $actorRole = null,
            ?int $claimedBy = null,
            ?int $releasedFrom = null,
        ): ?array {
            $id = $actorId ?? $claimedBy ?? $releasedFrom;
            if ($id === null || $id <= 0) {
                return null;
            }

            // Hot path: actor_name was snapshotted at creation time → skip
            // the legacy `User::find()` lookup. actor_role is also snapshotted
            // (see `IncidentNotificationObserver::resolveActorSnapshot`), so
            // the resource renders a full actor block with zero DB hits.
            // Rows that have actor_name but not actor_role (partial fix
            // edge case) still avoid the name query but pay one `User::find`
            // for the role — same cost as before, just shifted.
            if ($actorName !== null && $actorName !== '') {
                if ($actorRole !== null && $actorRole !== '') {
                    return $this->buildActorArray($id, $actorName, $actorRole);
                }

                $actor = User::find($id);

                return $this->buildActorArray(
                    $id,
                    $actorName,
                    $actor?->role?->name,
                );
            }

            // Legacy path: row written before the observer started snapshotting
            // actor_name — keep the previous `first_name` shape so the
            // frontend continues to render correctly until the row is purged.
            $actor = User::find($id);
            if ($actor === null) {
                return null;
            }

            return $this->buildActorArray(
                $actor->id,
                $actor->first_name,
                $actor->role?->name,
            );
        }

        /**
         * Build the actor array from already-resolved primitives. Centralises
         * the shape so all three resolution paths (modern snapshot, partial
         * snapshot, legacy User::find) emit identical JSON.
         */
        private function buildActorArray(int $id, ?string $name, ?string $role): ?array
        {
            if ($name === null || $name === '') {
                return null;
            }

            return [
                'id' => $id,
                'name' => $name,
                'role' => $role,
            ];
        }
}
