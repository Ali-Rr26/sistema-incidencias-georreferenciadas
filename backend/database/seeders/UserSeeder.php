<?php

namespace Database\Seeders;

use App\Domains\Organizations\Models\Organization;
use App\Domains\Roles\Enums\UserRole;
use App\Domains\Roles\Models\Role;
use App\Domains\Users\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $roleMap = Role::pluck('id', 'name')->toArray();

        $adminSistemaRoleId = $roleMap[UserRole::AdminSistema->value] ?? 1;
        $operadorSistemaRoleId = $roleMap[UserRole::OperadorSistema->value] ?? 2;
        $adminOrgRoleId = $roleMap[UserRole::AdminOrganizacion->value] ?? 3;
        $operadorOrgRoleId = $roleMap[UserRole::OperadorOrganizacion->value] ?? 4;
        $usuarioRoleId = $roleMap[UserRole::Usuario->value] ?? 5;

        // ─── 1. Usuarios Globales de Sistema ─────────────────────────────
        $globalUsers = [
            [
                'email' => 'admin@sistema.com',
                'password' => 'Admin123!',
                'role_id' => $adminSistemaRoleId,
                'first_name' => 'Admin Global',
                'last_name' => 'Sistema',
                'organization_id' => null,
            ],
            [
                'email' => 'operador@sistema.com',
                'password' => 'Operador123!',
                'role_id' => $operadorSistemaRoleId,
                'first_name' => 'Operador Global',
                'last_name' => 'Sistema',
                'organization_id' => null,
            ],
            [
                'email' => 'usuario@test.com',
                'password' => 'Usuario123!',
                'role_id' => $usuarioRoleId,
                'first_name' => 'Ciudadano',
                'last_name' => 'Ejemplo',
                'organization_id' => null,
            ],
        ];

        foreach ($globalUsers as $u) {
            User::query()->updateOrCreate(
                ['email' => $u['email']],
                [
                    'role_id' => $u['role_id'],
                    'organization_id' => $u['organization_id'],
                    'password' => Hash::make($u['password']),
                    'first_name' => $u['first_name'],
                    'last_name' => $u['last_name'],
                    'email_verified_at' => now(),
                ],
            );
            $this->command?->info("Usuario global [{$u['email']}] creado/actualizado.");
        }

        // ─── 2. Un Admin y un Operador por cada Organización ──────────────
        $organizations = Organization::all();

        foreach ($organizations as $org) {
            $slug = Str::slug($org->name);

            // Admin de Organización (role_id: admin_organizacion)
            $adminEmail = "admin.{$slug}@organizacion.com";
            User::query()->updateOrCreate(
                ['email' => $adminEmail],
                [
                    'role_id' => $adminOrgRoleId,
                    'organization_id' => $org->id,
                    'password' => Hash::make('Admin123!'),
                    'first_name' => 'Admin',
                    'last_name' => $org->name,
                    'email_verified_at' => now(),
                ],
            );
            $this->command?->info("  Admin Org [{$adminEmail}] -> {$org->name}");

            // Operador de Organización (role_id: operador_organizacion)
            $operadorEmail = "operador.{$slug}@organizacion.com";
            User::query()->updateOrCreate(
                ['email' => $operadorEmail],
                [
                    'role_id' => $operadorOrgRoleId,
                    'organization_id' => $org->id,
                    'password' => Hash::make('Operador123!'),
                    'first_name' => 'Operador',
                    'last_name' => $org->name,
                    'email_verified_at' => now(),
                ],
            );
            $this->command?->info("  Operador Org [{$operadorEmail}] -> {$org->name}");
        }
    }
}
