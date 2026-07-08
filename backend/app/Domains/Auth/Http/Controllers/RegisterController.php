<?php

declare(strict_types=1);

namespace App\Domains\Auth\Http\Controllers;

use App\Domains\Auth\Http\Requests\RegisterRequest;
use App\Domains\Auth\Services\RegisterService;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

/**
 * Thin controller for the public `POST /api/register` endpoint.
 *
 * No auto-login (per spec R1): the response is a 201 with a success
 * message; the frontend handles the redirect to /login with the
 * "Cuenta creada" banner. No cookies, no tokens, no session row
 * created — the new user is just a row in `users` until they
 * explicitly authenticate.
 */
class RegisterController
{
    public function __construct(
        private readonly RegisterService $registerService,
    ) {}

    public function register(RegisterRequest $request): JsonResponse
    {
        $this->registerService->register($request->validated());

        return response()->json(
            ['message' => 'Usuario creado correctamente'],
            Response::HTTP_CREATED,
        );
    }
}
