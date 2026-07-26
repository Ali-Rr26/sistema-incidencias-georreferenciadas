<?php

declare(strict_types=1);

namespace App\Domains\Auth\Local\Http\Controllers;

use App\Domains\Auth\Local\Http\Requests\ForgotPasswordRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Password;

class ForgotPasswordController
{
    public function __invoke(ForgotPasswordRequest $request): JsonResponse
    {
        $status = Password::sendResetLink(
            $request->only('email'),
        );

        if ($status === Password::RESET_LINK_SENT) {
            return response()->json(['message' => __('messages.reset_link_sent')]);
        }

        return response()->json([
            'message' => __('messages.reset_link_failed'),
        ], 400);
    }
}
