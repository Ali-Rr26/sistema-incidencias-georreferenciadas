<?php

namespace Database\Seeders;

use App\Domains\Roles\Enums\UserRole;
use App\Domains\Roles\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    private const ROLES = [
        ['id' => 1, 'name' => UserRole::AdminSistema->value],
        ['id' => 2, 'name' => UserRole::OperadorSistema->value],
        ['id' => 3, 'name' => UserRole::AdminOrganizacion->value],
        ['id' => 4, 'name' => UserRole::OperadorOrganizacion->value],
        ['id' => 5, 'name' => UserRole::Usuario->value],
    ];

    public function run(): void
    {
        foreach (self::ROLES as $role) {
            Role::query()->updateOrCreate(
                ['id' => $role['id']],
                $role,
            );

            $this->command?->info("Rol {$role['name']} creado/actualizado.");
        }
    }
}
