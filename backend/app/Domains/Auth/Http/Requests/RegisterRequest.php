<?php

declare(strict_types=1);

namespace App\Domains\Auth\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates a public self-service registration payload submitted to
 * `POST /api/register`. The endpoint is public, so `authorize()` is true
 * unconditionally — the auth boundary is the throttle middleware, not
 * the user session.
 *
 * The rules enforce the password policy from the spec (R3): 8+ chars,
 * at least one uppercase, one lowercase, and one digit. `confirmed`
 * matches `password` against `password_confirmation` automatically.
 */
class RegisterRequest extends FormRequest
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
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:20'],
            'password' => [
                'required',
                'string',
                'min:8',
                // One uppercase, one lowercase, one digit — each rule
                // produces its own error message so the client can
                // surface the specific weakness.
                'regex:/[A-Z]/',
                'regex:/[a-z]/',
                'regex:/\d/',
            ],
            // R4 — the match check lives on the confirmation field, NOT
            // as a `confirmed` rule on `password`. That way a mismatch
            // surfaces under the `password_confirmation` key (per spec)
            // instead of being attributed to `password`.
            'password_confirmation' => ['required', 'string', 'same:password'],
        ];
    }
}
