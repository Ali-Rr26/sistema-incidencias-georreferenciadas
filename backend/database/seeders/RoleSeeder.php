<?php

namespace Database\Seeders;

use App\Domains\Roles\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    private const ROLES = [
        ['id' => 1, 'name' => 'Admin'],
        ['id' => 2, 'name' => 'Operador'],
        ['id' => 3, 'name' => 'Usuario'],
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
