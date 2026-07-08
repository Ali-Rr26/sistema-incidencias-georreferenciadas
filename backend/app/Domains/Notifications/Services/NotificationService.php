<?php

declare(strict_types=1);

namespace App\Domains\Notifications\Services;

use App\Domains\Notifications\Enums\NotificationType;
use App\Domains\Notifications\Models\Notification;
use App\Domains\Users\Models\User;

/**
 * Crea notificaciones para usuarios objetivo.
 *
 * El servicio encapsula la regla "no duplicar notificaciones idénticas
 * recientes" (no le spameamos al operador con N copies del mismo claim)
 * y centraliza el armado del payload `data`.
 */
class NotificationService
{
    /**
     * Crea una notificación. Devuelve la instancia creada (o null si fue
     * descartada por deduplicación).
     *
     * @param  array<string, mixed>  $data
     */
    public function notify(
        User $user,
        NotificationType $type,
        string $message,
        ?int $incidentId = null,
        array $data = [],
    ): ?Notification {
        // Dedup simple: si ya existe una notificación idéntica (mismo user,
        // mismo type, mismo incident) en los últimos 60 segundos, no creamos otra.
        $exists = Notification::query()
            ->where('user_id', $user->id)
            ->where('type', $type->value)
            ->when($incidentId !== null, fn ($q) => $q->where('incident_id', $incidentId))
            ->where('created_at', '>=', now()->subSeconds(60))
            ->exists();

        if ($exists) {
            return null;
        }

        return Notification::create([
            'user_id' => $user->id,
            'incident_id' => $incidentId,
            'type' => $type->value,
            'message' => $message,
            'data' => $data,
            'read' => false,
        ]);
    }

    /**
     * Marca como leídas todas las notificaciones del usuario.
     */
    public function markAllAsRead(User $user): int
    {
        return Notification::query()
            ->forUser($user)
            ->unread()
            ->update(['read' => true]);
    }
}
