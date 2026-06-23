<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Http;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class IncidentController
{
    public function index(Request $request): JsonResponse
    {
        return response()->json(['data' => []]);
    }

    public function store(Request $request): JsonResponse
    {
        return response()->json(['data' => []], 201);
    }

    public function show(int $id): JsonResponse
    {
        return response()->json(['data' => []]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        return response()->json(['data' => []]);
    }

    public function destroy(int $id): JsonResponse
    {
        return response()->json(null, 204);
    }
}
