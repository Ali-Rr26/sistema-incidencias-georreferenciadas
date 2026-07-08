<?php

declare(strict_types=1);

namespace App\Domains\Notifications\Services;

use App\Domains\Notifications\Enums\NotificationType;
use App\Domains\Notifications\Http\Resources\NotificationResource;
use App\Domains\Notifications\Models\Notification;
use App\Domains\Users\Models\User;
use Symfony\Component\Mercure\HubInterface;
use Symfony\Component\Mercure\Update;

/**
 * Crea notificaciones para usuarios objetivo.
 *
 * El servicio encapsula la regla "no duplicar notificaciones idénticas
 * recientes" (no le spameamos al operador con N copies del mismo claim)
 * y centraliza el armado del payload `data`.
 */
class NotificationService
{
    public function __construct(
        private readonly HubInterface $hub,
    ) {}

    /**
     * Topic used both to publish a user's notifications and, on the
     * subscriber side, as the entry in their `mercure.subscribe` JWT claim.
     * Must match app-shell.component.js's subscription URL exactly.
     */
    public static function topicFor(int $userId): string
    {
        return "user:{$userId}:notifications";
    }

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

        $notification = Notification::create([
            'user_id' => $user->id,
            'incident_id' => $incidentId,
            'type' => $type->value,
            'message' => $message,
            'data' => $data,
            'read' => false,
        ]);

        $this->publish($user->id, $notification);

        return $notification;
    }

    /**
     * Publishes the notification to the user's private Mercure topic so an
     * open bell dropdown updates live. Publish failures (hub unreachable,
     * etc.) must never break notification creation — the bell falls back to
     * showing the notification next time /notifications is polled/opened.
     */
    private function publish(int $userId, Notification $notification): void
    {
        try {
            $payload = (new NotificationResource($notification))->resolve();
            $this->hub->publish(new Update(
                self::topicFor($userId),
                json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
                true,
            ));
        } catch (\Throwable $e) {
            report($e);
        }
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
