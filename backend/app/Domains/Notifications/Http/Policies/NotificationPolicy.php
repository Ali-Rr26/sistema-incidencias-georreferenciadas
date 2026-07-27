<?php

declare(strict_types=1);

namespace App\Domains\Notifications\Http\Policies;

use App\Domains\Notifications\Enums\NotificationType;
use App\Domains\Notifications\Models\Notification;
use App\Domains\Users\Models\User;

/**
 * Las notificaciones son privadas: solo el dueño puede leerlas o marcarlas.
 *
 * Las acciones `viewAny` / `create` / `update` / `delete` del Resource se
 * deniegan por defecto (no hay gestión de notificaciones desde la API más
 * allá de las acciones del dueño). `markRead` se chequea por separado con
 * `markAsRead()`.
 */
class NotificationPolicy
{
    public function viewAny(User $user): bool
    {
        return false;
    }

    public function view(User $user, Notification $notification): bool
    {
        return $user->id === $notification->user_id;
    }

    public function create(User $user): bool
    {
        return false;
    }

    public function update(User $user, Notification $notification): bool
    {
        return $user->id === $notification->user_id;
    }

    public function delete(User $user, Notification $notification): bool
    {
        return $user->id === $notification->user_id;
    }

    public function approve(User $user, Notification $notification): bool
    {
        return $this->canDecide($user, $notification);
    }

    public function reject(User $user, Notification $notification): bool
    {
        return $this->canDecide($user, $notification);
    }

    /**
     * Shared predicate for approve/reject authorization.
     *
     * Requires:
     *  - the actor holds `notifications.update` permission (admin_sistema /
     *    admin_organizacion, configured in the role permission seeder);
     *  - the notification belongs to the actor (only the recipient decides);
     *  - the notification is the approval type — admins MUST NOT be able to
     *    approve unrelated types like `comment`, `claim`, etc.;
     *  - there is no decision recorded yet — once approved/rejected, the
     *    decision is immutable from the API surface;
     *  - `expires_at` (when present) is still in the future.
     *
     * Without these checks an authorized admin could re-decide or decide
     * notifications of unrelated types. The controller re-checks the same
     * state atomically to prevent concurrent overwrite races.
     */
    private function canDecide(User $user, Notification $notification): bool
    {
        if (! $user->hasPermission('notifications.update')) {
            return false;
        }

        if ($user->id !== $notification->user_id) {
            return false;
        }

        if ($notification->type !== NotificationType::IncidenciaAtendidaParaAprobacion) {
            return false;
        }

        $data = $notification->data ?? [];
        if (! empty($data['decision'])) {
            return false;
        }

        $expiresAt = $data['expires_at'] ?? null;
        if ($expiresAt !== null) {
            try {
                if (new \DateTimeImmutable($expiresAt) <= new \DateTimeImmutable) {
                    return false;
                }
            } catch (\Throwable) {
                return false;
            }
        }

        return true;
    }

    /**
     * Acción específica de PATCH .../read — equivalente a update en este caso.
     */
    public function markAsRead(User $user, Notification $notification): bool
    {
        return $this->update($user, $notification);
    }
}
