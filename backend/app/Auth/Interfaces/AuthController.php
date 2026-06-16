<?php

namespace App\Auth\Interfaces;

use App\Users\Infrastructure\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

class AuthController
{
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Las credenciales proporcionadas son incorrectas.'],
            ]);
        }

        $user->tokens()->whereIn('name', ['access', 'refresh'])->delete();

        $accessToken = $user->createToken('access', ['*'], now()->addMinutes(15));
        $refreshToken = $user->createToken('refresh', ['refresh'], now()->addDays(30));

        return response()->json([
            'access_token' => $accessToken->plainTextToken,
            'refresh_token' => $refreshToken->plainTextToken,
            'token_type' => 'Bearer',
            'expires_in' => 900,
            'user' => $user,
        ]);
    }

    public function refresh(Request $request): JsonResponse
    {
        $request->validate([
            'refresh_token' => 'required|string',
        ]);

        $parts = explode('|', $request->refresh_token);
        if (count($parts) !== 2) {
            return response()->json(['message' => 'El formato del token es inválido'], Response::HTTP_UNAUTHORIZED);
        }

        [$tokenId, $plainToken] = $parts;

        /** @var PersonalAccessToken|null $token */
        $token = PersonalAccessToken::find($tokenId);

        if (! $token || ! hash_equals($token->token, hash('sha256', $plainToken))) {
            return response()->json(['message' => 'El token de refresco es inválido'], Response::HTTP_UNAUTHORIZED);
        }

        if (! $token->can('refresh')) {
            return response()->json(['message' => 'El token no es un token de refresco'], Response::HTTP_UNAUTHORIZED);
        }

        if ($token->expires_at && $token->expires_at->isPast()) {
            return response()->json(['message' => 'El token de refresco ha expirado'], Response::HTTP_UNAUTHORIZED);
        }

        /** @var User $user */
        $user = $token->tokenable;

        $user->tokens()->where('name', 'access')->delete();

        $newAccess = $user->createToken('access', ['*'], now()->addMinutes(15));

        return response()->json([
            'access_token' => $newAccess->plainTextToken,
            'refresh_token' => $request->refresh_token,
            'token_type' => 'Bearer',
            'expires_in' => 900,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Sesión cerrada exitosamente']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(
            $request->user()->load('role')
        );
    }
}
