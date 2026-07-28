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
 *
 * WU3 (PR-1c): `approve` y `reject` delegan en `canDecide()`, que es
 * estrictamente una policy `who` (¿quién puede decidir?). Las invariantes
 * de estado (status `resolved`, sin decisión previa, no expirada, tipo
 * correcto) viven en `IncidentApprovalService::decide()` desde PR-1b.
 * Mover esos checks al service los hace bypass-proof: `Gate::before` en
 * `AppServiceProvider` deja pasar a `admin_sistema` por encima de cualquier
 * policy, pero el service no es saltable — el `DB::transaction` + el
 * `lockForUpdate` en la fila del incidente es la barrera de defensa.
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
     * Authorization predicate for approve/reject — `who` only.
     *
     * Admits the action iff the actor is one of:
     *  - `admin_sistema` (covers the Gate::before bypass);
     *  - `admin_organizacion` whose `organization_id` matches the
     *    `incident->organization_id` (so an admin from org B cannot
     *    decide on an incident that belongs to org A).
     *
     * No type / decision / expiry checks here. Those are runtime
     * invariants that belong to the service. The policy MUST stay
     * bypassable by `admin_sistema` (that's the point of `Gate::before`)
     * while the service MUST stay bypass-proof (it owns the transaction).
     */
    private function canDecide(User $user, Notification $notification): bool
    {
        if ($user->isSystemAdmin()) {
            return true;
        }

        if ($user->isOrganizationAdmin()) {
            return $user->organization_id === $notification->incident?->organization_id;
        }

        return false;
    }

    /**
     * Acción específica de PATCH .../read — equivalente a update en este caso.
     */
    public function markAsRead(User $user, Notification $notification): bool
    {
        return $this->update($user, $notification);
    }
}
