<?php

declare(strict_types=1);

namespace App\Domains\Notifications\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class NotificationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type?->value,
            'message' => $this->message,
            'data' => array_merge([
                'incident_id' => $this->incident_id,
                'actor_user_id' => null,
                'decision' => null,
                'rejection_reason' => null,
                'expires_at' => null,
                'organization_id' => null,
            ], $this->data ?? []),
            'read' => (bool) $this->read,
            'read_at' => $this->read ? $this->updated_at?->toIso8601String() : null,
            'created_at' => $this->created_at?->toIso8601String(),
            'incident' => $this->whenLoaded('incident', fn () => $this->incident ? [
                'id' => $this->incident->id,
                'title' => $this->incident->title,
            ] : null),
        ];
    }
}
