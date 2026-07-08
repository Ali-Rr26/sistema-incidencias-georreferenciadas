<?php

declare(strict_types=1);

namespace App\Domains\Auth\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates a Google ID-token payload submitted to
 * `POST /api/auth/google`. The endpoint is public, so `authorize()`
 * returns true unconditionally — the auth boundary is the throttle
 * middleware + the Firebase token verification, not the user session.
 *
 * The id_token is opaque here; the GoogleAuthService passes it to
 * the FirebaseTokenVerifier which actually validates the signature,
 * audience, and expiry. This request only guarantees the string is
 * present and shaped like a JWT (>=10 chars, <= 4096).
 */
class GoogleLoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'id_token' => ['required', 'string', 'min:10', 'max:4096'],
        ];
    }
}
