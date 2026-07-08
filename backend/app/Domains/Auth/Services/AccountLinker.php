<?php

declare(strict_types=1);

namespace App\Domains\Auth\Services;

use App\Domains\Auth\Exceptions\RejectedUnverifiedException;
use App\Domains\Roles\Enums\UserRole;
use App\Domains\Roles\Models\Role;
use App\Domains\Users\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Encapsulates the link-or-create decision for Google ID-token
 * login. Three branches:
 *
 *   1. No user with that email            → create a Google-only
 *      account with role=usuario, random unusable password, and
 *      `email_verified_at = now()` (Google already verified it).
 *   2. Existing user, email_verified=true → return that user (link).
 *      Their existing password is preserved (R8).
 *   3. Existing user, email_verified=null → throw
 *      RejectedUnverifiedException. The user signed up via /register
 *      and never confirmed; they must use their password (and finish
 *      email-verification when that flow lands) to authenticate.
 *
 * Anti-elevation (R13b): the create branch ALWAYS hardcodes
 * `role_id` to the citizen role (`usuario`). Never reads any role
 * from the incoming token or the database — the join key is email,
 * but the role assignment is server-only.
 */
class AccountLinker
{
    /**
     * @throws RejectedUnverifiedException
     */
    public function linkOrCreate(VerifiedFirebaseToken $token): User
    {
        $existing = User::where('email', $token->email)->first();

        if ($existing !== null) {
            if ($existing->email_verified_at !== null) {
                // Verified existing account → link path, R8.
                return $existing;
            }

            // Unverified existing account → reject, R9.
            throw new RejectedUnverifiedException;
        }

        return $this->createGoogleUser($token);
    }

    /**
     * Create a fresh citizen user from the verified Firebase claims.
     * The password is a 64-char random string, hashed — unusable for
     * password login, which is the locked design decision (a Google
     * user who later wants a password must go through a "set password"
     * flow that is OUT OF SCOPE for this change).
     */
    private function createGoogleUser(VerifiedFirebaseToken $token): User
    {
        $citizenRole = Role::where('name', UserRole::Usuario->value)->first();

        if ($citizenRole === null) {
            // Mirror RegisterService's failure mode: a misconfigured
            // DB that lacks the citizen role is loud, not silent.
            throw new \RuntimeException(
                'No se pudo registrar el usuario Google: el rol "usuario" no existe en la base de datos.'
            );
        }

        return User::create([
            'role_id' => $citizenRole->id,
            'email' => $token->email,
            'password' => Hash::make(Str::random(64)),
            'first_name' => $token->firstName,
            'last_name' => $token->lastName,
            // Google already verified the email — pin the timestamp
            // so the link path on a subsequent login still works.
            'email_verified_at' => now(),
        ]);
    }
}
