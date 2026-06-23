<?php

declare(strict_types=1);

namespace App\Domains\Roles\Http\Policies;

use App\Domains\Roles\Models\Role;
use App\Domains\Users\Models\User;

class RolePolicy
{
    public function viewAny(User $currentUser): bool
    {
        return $currentUser->can('roles.view');
    }

    public function view(User $currentUser, Role $targetRole): bool
    {
        return $currentUser->can('roles.view');
    }

    public function create(User $currentUser): bool
    {
        return $currentUser->can('roles.create');
    }

    public function update(User $currentUser, Role $targetRole): bool
    {
        return $currentUser->can('roles.update');
    }

    public function delete(User $currentUser, Role $targetRole): bool
    {
        return $currentUser->can('roles.delete');
    }

}
