<?php

declare(strict_types=1);

namespace App\Domains\Users\Http\Policies;

use App\Domains\Shared\Http\Policies\PermissionPolicy;
use App\Domains\Users\Models\User;
use Illuminate\Database\Eloquent\Model;

class UserPolicy extends PermissionPolicy
{
    protected function resource(): string
    {
        return 'users';
    }

    public function view(User $user, Model $model): bool
    {
        return $user->can('users.view') || $user->id === $model->id;
    }

    public function update(User $user, Model $model): bool
    {
        return $user->can('users.update') || $user->id === $model->id;
    }

    public function delete(User $user, Model $model): bool
    {
        return $user->can('users.delete') || $user->id === $model->id;
    }
}
