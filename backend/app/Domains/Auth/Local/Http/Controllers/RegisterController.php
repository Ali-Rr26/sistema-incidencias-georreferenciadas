<?php

declare(strict_types=1);

namespace App\Domains\Auth\Local\Http\Controllers;

use App\Domains\Auth\Local\Http\Requests\RegisterRequest;
use App\Domains\Auth\Local\Services\RegisterService;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

class RegisterController
{
    public function __construct(
        private readonly RegisterService $registerService,
    ) {}

    public function register(RegisterRequest $request): JsonResponse
    {
        $this->registerService->register($request->validated());

        // Story sc-117 — el frontend usa `requires_verification: true`
        // como señal para mostrar la pantalla "Verifica tu correo"
        // (POST /api/email/resend) en lugar de volver al login.
        return response()->json(
            [
                'message' => 'Usuario creado correctamente',
                'requires_verification' => true,
            ],
            Response::HTTP_CREATED,
        );
    }
}
