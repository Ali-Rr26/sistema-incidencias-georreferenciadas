<?php

declare(strict_types=1);

namespace App\Domains\Users\Repositories;

use App\Domains\Shared\Repositories\EloquentRepository;
use App\Domains\Users\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Auth;

class EloquentUserRepository extends EloquentRepository implements UserRepository
{
    public function __construct()
    {
        parent::__construct(new User);
    }

    public function findByEmail(string $email): ?User
    {
        return $this->newQuery()->where('email', $email)->first();
    }

    protected function newQuery(): Builder
    {
        return parent::newQuery()->with(['role', 'organization']);
    }

    protected function applyFilters(Builder $query, array $filters): void
    {
        // Scoping por organización (Multitenancy)
        /** @var User|null $user */
        $user = Auth::user();
        if ($user !== null && !$user->isSystemAdmin()) {
            if ($user->isOrganizationAdmin() || $user->isOperator()) {
                $query->where('organization_id', $user->organization_id);
            } else {
                $query->whereRaw('1 = 0'); // Usuarios comunes o publicadores no listan usuarios
            }
        }

        $query
            ->when($filters['role_id'] ?? null, fn (Builder $query, string $value) => $query->where('role_id', $value))
            ->when($filters['organization_id'] ?? null, fn (Builder $query, string $value) => $query->where('organization_id', $value))
            ->when($filters['search'] ?? null, fn (Builder $query, string $value) => $query->where(function (Builder $query) use ($value) {
                $query->where('first_name', 'LIKE', "%{$value}%")
                    ->orWhere('last_name', 'LIKE', "%{$value}%")
                    ->orWhere('email', 'LIKE', "%{$value}%");
            }));
    }
}
