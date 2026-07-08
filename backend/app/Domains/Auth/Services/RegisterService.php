<?php

declare(strict_types=1);

namespace App\Domains\Auth\Services;

use App\Domains\Roles\Enums\UserRole;
use App\Domains\Roles\Models\Role;
use App\Domains\Users\Models\User;
use Illuminate\Support\Facades\Log;

/**
 * Creates a citizen user from a validated registration payload.
 *
 * Anti-elevation guarantee (R1, R5, R13a): the role_id assigned to the
 * new user is resolved server-side from `Role::where('name', 'usuario')`
 * and is NEVER read from the request payload. The `role_id` key is
 * explicitly stripped from `$data` as belt-and-braces — even if the
 * controller somehow forwarded it, the service would ignore it.
 */
class RegisterService
{
    /**
     * @param  array<string, mixed>  $data  Validated payload from RegisterRequest
     *
     * @throws \RuntimeException When the citizen role row is missing from the database.
     */
    public function register(array $data): User
    {
        // Defense in depth: the request layer doesn't accept role_id,
        // but if a future refactor exposes it, the service still
        // refuses to honor it. The role assignment is server-only.
        unset($data['role_id']);

        $citizenRole = Role::where('name', UserRole::Usuario->value)->first();

        if ($citizenRole === null) {
            // Surface fast and loud — a misconfigured seed that drops
            // the citizen role would otherwise silently fail (FK
            // violation) or worse, default to whatever the DB hands
            // back. Misconfiguration must NOT be a footgun.
            throw new \RuntimeException(
                'No se pudo registrar el usuario: el rol "usuario" no existe en la base de datos.'
            );
        }

        $user = User::create([
            'role_id' => $citizenRole->id,
            'email' => $data['email'],
            'password' => $data['password'], // cast 'hashed' in User::casts() handles Hash::make
            'first_name' => $data['first_name'],
            'last_name' => $data['last_name'],
            'phone' => $data['phone'] ?? null,
            // email_verified_at stays null — out of scope per the spec
            // (no email-verification flow exists yet).
        ]);

        Log::info('auth.register.success', [
            'user_id' => $user->id,
            'email_hash' => hash('sha256', (string) $user->email),
        ]);

        return $user;
    }
}
