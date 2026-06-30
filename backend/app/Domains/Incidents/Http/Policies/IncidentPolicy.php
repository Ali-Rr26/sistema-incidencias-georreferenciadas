<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Http\Policies;

use App\Domains\Incidents\Models\Incident;
use App\Domains\Roles\Enums\UserRole;
use App\Domains\Shared\Http\Policies\PermissionPolicy;
use App\Domains\Users\Models\User;

class IncidentPolicy extends PermissionPolicy
{
    protected function resource(): string
    {
        return 'incidents';
    }

    /**
     * Un OperadorOrg puede claim una incidencia solo si:
     * - es de su organización
     * - no está ya asignada
     */
    public function claim(User $user, Incident $incident): bool
    {
        if ($user->role?->name !== UserRole::OperadorOrganizacion->value) {
            return false;
        }

        return $incident->organization_id === $user->organization_id;
    }

    /**
     * Un OperadorOrg puede release solo las incidencias que él mismo claimeó.
     */
    public function release(User $user, Incident $incident): bool
    {
        if ($user->role?->name !== UserRole::OperadorOrganizacion->value) {
            return false;
        }

        return $incident->claimed_by === $user->id;
    }

    /**
     * Un Publicador puede confirmar una incidencia solo si:
     * - la categoría coincide con la de su organización
     */
    public function confirm(User $user, Incident $incident): bool
    {
        if ($user->role?->name !== UserRole::Publicador->value) {
            return false;
        }

        $org = $user->organization;

        return $org !== null
            && $incident->incident_category_id === $org->incident_category_id;
    }
}
