<?php

declare(strict_types=1);

namespace App\Domains\Auth\Services;

use App\Domains\Auth\Contracts\FirebaseTokenVerifier;
use App\Domains\Auth\Exceptions\InvalidFirebaseTokenException;
use App\Domains\Auth\Exceptions\RejectedUnverifiedException;
use Illuminate\Support\Facades\Log;

/**
 * Orchestrates the /auth/google flow end-to-end.
 *
 *   1. verify the ID token via the contract (R10)
 *   2. link-or-create the local user via AccountLinker (R7 / R8 / R9)
 *   3. issue a session via the shared AuthService::issueSession helper
 *      (refactored out of AuthService::login in the previous commit
 *      so the email and Google flows share identical JWT + cookie
 *      plumbing)
 *
 * Returns the same array shape as AuthService::login — the controller
 * emits the same JSON body + httpOnly cookies.
 *
 * Side effects:
 *   - logs `auth.google.created` (R7) — Google-only user created
 *   - logs `auth.google.linked` (R8) — linked to existing verified acct
 *   - logs `auth.google.rejected_unverified` (R9) — security signal
 */
class GoogleAuthService
{
    public function __construct(
        private readonly FirebaseTokenVerifier $verifier,
        private readonly AccountLinker $linker,
        private readonly AuthService $authService,
    ) {}

    /**
     * @return array{accessToken: string, refreshToken: string, expiresIn: int, user: User}
     *
     * @throws InvalidFirebaseTokenException R10
     * @throws RejectedUnverifiedException R9
     */
    public function login(string $idToken, ?string $ip, ?string $ua): array
    {
        $token = $this->verifier->verify($idToken);

        $user = $this->linker->linkOrCreate($token);

        // Log AFTER the linker resolves the user so the event carries
        // the right user_id for both created and linked branches.
        Log::info($user->wasRecentlyCreated ? 'auth.google.created' : 'auth.google.linked', [
            'user_id' => $user->id,
            'email_hash' => hash('sha256', (string) $user->email),
        ]);

        return $this->authService->issueSession($user, $ip, $ua);
    }
}
