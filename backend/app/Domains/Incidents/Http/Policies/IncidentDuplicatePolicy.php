<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Http\Policies;

use App\Domains\Incidents\Models\IncidentDuplicate;
use App\Domains\Roles\Enums\UserRole;
use App\Domains\Shared\Http\Policies\PermissionPolicy;
use App\Domains\Users\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * Authorization for manual duplicate-marking.
 *
 * create  — any authenticated user
 * viewAny — public (the public GET endpoint lists confirmed duplicates)
 * view    — public
 * update  — only staff (admin_sistema / admin_organizacion / operador_sistema
 *           / operador_organizacion). The spec's "only staff can review"
 *           rule is enforced here. A plain user who can mark a duplicate
 *           cannot confirm/reject it.
 * delete  — never (review is a status change, not a delete).
 */
class IncidentDuplicatePolicy extends PermissionPolicy
{
    protected function resource(): string
    {
        return 'incidents';
    }

    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Model $model): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user !== null;
    }

    public function update(User $user, Model $model): bool
    {
        if ($user === null) {
            return false;
        }

        if ($user->isSystemAdmin()) {
            return true;
        }

        $role = $user->role?->name;

        return in_array($role, [
            UserRole::AdminOrganizacion->value,
            UserRole::OperadorSistema->value,
            UserRole::OperadorOrganizacion->value,
        ], true);
    }

    public function delete(User $user, Model $model): bool
    {
        return false;
    }
}
