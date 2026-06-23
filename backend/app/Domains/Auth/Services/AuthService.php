<?php

declare(strict_types=1);

namespace App\Domains\Auth\Services;

use App\Domains\Auth\Exceptions\AuthenticationException;
use App\Domains\Sessions\Domain\Repositories\SessionRepository;
use App\Domains\Users\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AuthService
{
    public function __construct(
        private readonly JwtService $jwtService,
        private readonly SessionRepository $sessionRepository,
    ) {}

    /**
     * @return array{accessToken: string, refreshToken: string, expiresIn: int, user: User}
     *
     * @throws AuthenticationException
     */
    public function login(string $email, string $password, ?string $ip, ?string $ua): array
    {
        /** @var User|null $user */
        $user = User::where('email', $email)->first();

        if ($user === null || ! Hash::check($password, $user->password)) {
            throw new AuthenticationException(
                'Las credenciales proporcionadas son incorrectas.',
                'email',
            );
        }

        $sessionId = (string) Str::uuid();

        $accessToken = $this->jwtService->issueAccessToken(
            (string) $user->id,
            $sessionId,
            $user->email,
        );

        $refreshToken = $this->jwtService->issueRefreshToken(
            (string) $user->id,
            $sessionId,
            $user->email,
        );

        $this->sessionRepository->create(
            userId: (string) $user->id,
            refreshHash: Hash::make($refreshToken),
            ip: $ip,
            ua: $ua,
            expiresAt: Carbon::now()->addDays(30),
            id: $sessionId,
        );

        return [
            'accessToken' => $accessToken,
            'refreshToken' => $refreshToken,
            'expiresIn' => 900,
            'user' => $user,
        ];
    }

    /**
     * @return array{accessToken: string, refreshToken: string, expiresIn: int}
     *
     * @throws AuthenticationException
     */
    public function refresh(string $refreshToken, ?string $ip, ?string $ua): array
    {
        if ($refreshToken === '') {
            throw new AuthenticationException('No se encontró el token de refresco.');
        }

        $claims = $this->jwtService->validateRefreshToken($refreshToken);

        if ($claims === null) {
            throw new AuthenticationException('El token de refresco es inválido o ha expirado.');
        }

        $session = $this->sessionRepository->findById($claims['sid']);

        if ($session === null || ! $session->isValid()) {
            throw new AuthenticationException('La sesión no es válida o ha sido revocada.');
        }

        if ((int) $session->getUserId() !== (int) $claims['sub']) {
            throw new AuthenticationException('El token de refresco no corresponde a la sesión.');
        }

        if (! Hash::check($refreshToken, $session->getRefreshTokenHash())) {
            throw new AuthenticationException('El token de refresco no coincide con nuestros registros.');
        }

        /** @var User|null $user */
        $user = User::find((int) $claims['sub']);

        if ($user === null) {
            throw new AuthenticationException('Usuario no encontrado.');
        }

        $newAccess = $this->jwtService->issueAccessToken(
            (string) $user->id,
            $session->getId(),
            $user->email,
        );

        $newRefresh = $this->jwtService->issueRefreshToken(
            (string) $user->id,
            $session->getId(),
            $user->email,
        );

        $this->sessionRepository->update(
            id: $session->getId(),
            newHash: Hash::make($newRefresh),
            ip: $ip,
            ua: $ua,
            expiresAt: Carbon::now()->addDays(30),
        );

        return [
            'accessToken' => $newAccess,
            'refreshToken' => $newRefresh,
            'expiresIn' => 900,
        ];
    }

    public function revokeSession(string $sessionId): void
    {
        $this->sessionRepository->revoke($sessionId);
    }
}
