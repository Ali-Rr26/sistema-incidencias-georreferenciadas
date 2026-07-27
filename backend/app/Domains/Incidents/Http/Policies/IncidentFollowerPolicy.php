<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Http\Policies;

use App\Domains\Incidents\Models\IncidentFollower;
use App\Domains\Shared\Http\Policies\PermissionPolicy;
use App\Domains\Users\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * Authorization for "Seguir" (follow) actions.
 *
 * Mirrors {@see MeTooReportPolicy} — auth-only create, owner-only delete.
 * The only difference is the resource slug (still 'incidents' for the
 * scope, since the seed grants are the same).
 */
class IncidentFollowerPolicy extends PermissionPolicy
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

    public function delete(User $user, Model $model): bool
    {
        return $user !== null && (int) $model->user_id === (int) $user->id;
    }
}
