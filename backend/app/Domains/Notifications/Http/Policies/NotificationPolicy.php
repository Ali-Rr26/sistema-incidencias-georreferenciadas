<?php

declare(strict_types=1);

namespace App\Domains\Notifications\Http\Policies;

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

    /**
     * Acción específica de PATCH .../read — equivalente a update en este caso.
     */
    public function markAsRead(User $user, Notification $notification): bool
    {
        return $this->update($user, $notification);
    }
}