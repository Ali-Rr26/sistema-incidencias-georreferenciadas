<?php

namespace Database\Seeders;

use App\Users\Infrastructure\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    /** Usuarios por defecto del sistema */
    private const USERS = [
        [
            'email'      => 'admin@sistema.com',
            'password'   => 'Admin123!',
            'role_id'    => 1,
            'first_name' => 'Admin',
            'last_name'  => 'Sistema',
        ],
        [
            'email'      => 'test@test.com',
            'password'   => 'password',
            'role_id'    => 1,
            'first_name' => 'Test',
            'last_name'  => 'User',
        ],
    ];

    public function run(): void
    {
        foreach (self::USERS as $user) {
            User::query()->updateOrCreate(
                ['email' => $user['email']],
                [
                    'role_id'    => $user['role_id'],
                    'password'   => Hash::make($user['password']),
                    'first_name' => $user['first_name'],
                    'last_name'  => $user['last_name'],
                ],
            );

            $this->command?->info("Usuario {$user['email']} creado/actualizado.");
        }
    }
}
