<?php

namespace Database\Seeders;

use App\Domains\Users\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    /** Usuarios por defecto del sistema */
    private const USERS = [
        // ─── Admin ───────────────────────────────────
        [
            'email' => 'admin@sistema.com',
            'password' => 'Admin123!',
            'role_id' => 1, // Admin
            'first_name' => 'Admin',
            'last_name' => 'Sistema',
        ],
        [
            'email' => 'admin2@sistema.com',
            'password' => 'Admin123!',
            'role_id' => 1,
            'first_name' => 'Admin',
            'last_name' => 'Secundario',
        ],

        // ─── Operadores ──────────────────────────────
        [
            'email' => 'operador1@sistema.com',
            'password' => 'Operador123!',
            'role_id' => 2, // Operador
            'first_name' => 'Carlos',
            'last_name' => 'García',
        ],
        [
            'email' => 'operador2@sistema.com',
            'password' => 'Operador123!',
            'role_id' => 2,
            'first_name' => 'María',
            'last_name' => 'López',
        ],

        // ─── Usuarios regulares ──────────────────────
        [
            'email' => 'usuario1@test.com',
            'password' => 'Usuario123!',
            'role_id' => 3, // Usuario
            'first_name' => 'Juan',
            'last_name' => 'Pérez',
        ],
        [
            'email' => 'usuario2@test.com',
            'password' => 'Usuario123!',
            'role_id' => 3,
            'first_name' => 'Ana',
            'last_name' => 'Martínez',
        ],
    ];

    public function run(): void
    {
        foreach (self::USERS as $user) {
            User::query()->updateOrCreate(
                ['email' => $user['email']],
                [
                    'role_id' => $user['role_id'],
                    'password' => Hash::make($user['password']),
                    'first_name' => $user['first_name'],
                    'last_name' => $user['last_name'],
                ],
            );

            $this->command?->info("Usuario {$user['email']} creado/actualizado.");
        }
    }
}
