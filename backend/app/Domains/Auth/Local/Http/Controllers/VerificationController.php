<?php

declare(strict_types=1);

namespace App\Domains\Auth\Local\Http\Controllers;

use App\Domains\Auth\Local\Notifications\VerifyEmailMail;
use App\Domains\Users\Models\User;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\URL;
use Symfony\Component\HttpFoundation\Response;

/**
 * Verificación de correo electrónico — story sc-117.
 *
 * Endpoints:
 *
 *   GET  /api/email/verify/{id}/{hash}        (verify  — pública, signed URL)
 *   POST /api/email/resend                     (resend  — autenticada, throttle)
 *   GET  /api/email/notice                     (notice  — autenticada)
 *
 * Esta clase NO contiene la lógica de generación de URLs firmadas: el
 * mail (VerifyEmailMail) la delega a `URL::temporarySignedRoute`
 * vinculado a la ruta `verification.verify` (que es la GET pública de
 * arriba). El middleware `signed` valida `signature` y `expires` en la
 * query string. La validación se hace antes de llegar al método
 * `verify()`, así que dentro del mismo asumimos `signature` válido.
 */
class VerificationController
{
    /**
     * GET /api/email/verify/{id}/{hash}
     *
     * Ruta firmada con `signed` middleware (verificación de firma +
     * expiración). También verificamos que el `hash` del email coincida
     * con el hash actual (defense in depth — si un admin rota el correo
     * del usuario mientras el enlace está en vuelo, el enlace viejo
     * deja de aplicar).
     */
    public function verify(Request $request, int|string $id, string $hash): JsonResponse
    {
        /** @var User|null $user */
        $user = User::find($id);

        if ($user === null) {
            return $this->verificationFailed('verification_invalid', 'El usuario asociado al enlace no existe.');
        }

        if (! hash_equals(sha1((string) $user->getEmailForVerification()), (string) $hash)) {
            return $this->verificationFailed('verification_invalid', 'El enlace de verificación no es válido o ya fue utilizado.');
        }

        if ($user->hasVerifiedEmail()) {
            // Idempotente — si el usuario pica el enlace dos veces,
            // devolvemos 200 igual y no devolvemos error. Esto evita
            // falsos negativos en clientes que reintenten.
            return $this->verificationSucceeded($user);
        }

        if ($user->markEmailAsVerified()) {
            Log::info('auth.email_verified', [
                'user_id' => $user->id,
                'email_hash' => hash('sha256', (string) $user->email),
            ]);
        }

        return $this->verificationSucceeded($user);
    }

    /**
     * POST /api/email/verify-otp
     *
     * Permite verificar el correo ingresando un código OTP de 6 dígitos.
     */
    public function verifyOtp(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email'],
            'otp' => ['required', 'string', 'size:6'],
        ]);

        /** @var User|null $user */
        $user = User::where('email', strtolower($validated['email']))->first();

        if ($user === null) {
            return $this->verificationFailed('user_not_found', 'El correo ingresado no está registrado.');
        }

        if ($user->hasVerifiedEmail()) {
            return $this->verificationSucceeded($user);
        }

        if (! $user->verifyOtp($validated['otp'])) {
            return response()->json([
                'message' => 'El código OTP es inválido o ha expirado.',
                'code' => 'otp_invalid',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        Log::info('auth.email_verified_otp', [
            'user_id' => $user->id,
            'email_hash' => hash('sha256', (string) $user->email),
        ]);

        return $this->verificationSucceeded($user);
    }

    /**
     * POST /api/email/resend
     */
    public function resend(Request $request): JsonResponse
    {
        $email = $request->input('email');
        /** @var User|null $user */
        $user = $request->user() ?? ($email ? User::where('email', strtolower((string) $email))->first() : null);

        if ($user === null) {
            return response()->json([
                'message' => __('messages.verification_sent'),
            ], Response::HTTP_ACCEPTED);
        }

        if ($user->hasVerifiedEmail()) {
            return response()->json([
                'message' => __('messages.email_already_verified'),
            ], Response::HTTP_OK);
        }

        $user->sendEmailVerificationNotification();

        return response()->json([
            'message' => __('messages.verification_sent'),
        ], Response::HTTP_ACCEPTED);
    }

    /**
     * GET /api/email/notice
     *
     * Reporta el estado de verificación del usuario autenticado. El
     * frontend lo consulta en el flujo "estoy logueado pero olvidé
     * verificar" o al cargar el dashboard para mostrar banner de
     * "verifica tu correo".
     */
    public function notice(Request $request): JsonResponse
    {
        /** @var User|null $user */
        $user = $request->user();

        if ($user === null) {
            return response()->json([
                'message' => __('messages.unauthenticated'),
            ], Response::HTTP_UNAUTHORIZED);
        }

        return response()->json([
            'verified' => $user->hasVerifiedEmail(),
            'verified_at' => optional($user->email_verified_at)->toIso8601String(),
        ]);
    }

    private function verificationSucceeded(User $user): JsonResponse
    {
        return response()->json([
            'message' => __('messages.verification_success'),
            'verified' => true,
            'user_id' => (int) $user->id,
        ]);
    }

    private function verificationFailed(string $code, string $message): JsonResponse
    {
        return response()->json([
            'message' => $message,
            'code' => $code,
        ], Response::HTTP_FORBIDDEN);
    }
}
