<?php

declare(strict_types=1);

namespace App\Domains\Users\Http\Policies;

use App\Domains\Users\Models\User;

class UserPolicy
{
    public function viewAny(User $currentUser): bool
    {
        return $currentUser->can('users.view');
    }

    public function view(User $currentUser, User $targetUser): bool
    {
        return $currentUser->can('users.view') 
            || $currentUser->id === $targetUser->id;
    }

    public function create(User $currentUser): bool
    {
        return $currentUser->can('users.create');
    }

    public function update(User $currentUser, User $targetUser): bool
    {
        return $currentUser->can('users.update')
            || $currentUser->id === $targetUser->id;
    }

    public function delete(User $currentUser, User $targetUser): bool
    {
        return $currentUser->can('users.delete')
            || $currentUser->id === $targetUser->id;
    }
}

