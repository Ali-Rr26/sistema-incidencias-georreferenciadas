<?php

declare(strict_types=1);

namespace App\StatusHistory\Interfaces;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StatusHistoryController
{
    public function index(Request $request, int $incidentId): JsonResponse
    {
        return response()->json(['data' => []]);
    }
}
