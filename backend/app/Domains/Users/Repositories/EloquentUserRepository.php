<?php

declare(strict_types=1);

namespace App\Domains\Users\Repositories;

use App\Domains\Shared\Repositories\EloquentRepository;
use App\Domains\Users\Models\User;
use Illuminate\Database\Eloquent\Builder;

class EloquentUserRepository extends EloquentRepository implements UserRepository
{
    public function __construct()
    {
        parent::__construct(new User());
    }

    public function findByEmail(string $email): ?User
    {
        return $this->newQuery()->where('email', $email)->first();
    }

    protected function applyFilters(Builder $query, array $filters): void
    {
        $query
            ->when($filters['role_id'] ?? null, fn(Builder $query, string $value) => $query->where('role_id', $value))
            ->when($filters['search'] ?? null, fn(Builder $query, string $value) => $query->where(function(Builder $query) use($value) {
                $query->where('first_name', 'LIKE', "%{$value}%")
                  ->orWhere('last_name', 'LIKE', "%{$value}%")
                  ->orWhere('email', 'LIKE', "%{$value}%");
            }));
    }
}
