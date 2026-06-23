<?php

declare(strict_types=1);

namespace App\Domains\Notifications\Http;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController
{
    public function index(Request $request): JsonResponse
    {
        return response()->json(['data' => []]);
    }

    public function markRead(Request $request, int $id): JsonResponse
    {
        return response()->json(['data' => []]);
    }
}
