<?php

declare(strict_types=1);

namespace App\StatusHistory\Interfaces;

use App\Domains\Incidents\Models\Incident;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StatusHistoryController
{
    private const ESTADO_LABELS = [
        Incident::STATUS_PENDING     => 'Pendiente',
        Incident::STATUS_IN_PROGRESS => 'En Proceso',
        Incident::STATUS_RESOLVED    => 'Resuelto',
        Incident::STATUS_CLOSED      => 'Cerrado',
    ];

    public function index(Request $request, int $incidentId): JsonResponse
    {
        return response()->json(['data' => []]);
    }

    public function estados(): JsonResponse
    {
        $estados = collect(self::ESTADO_LABELS)
            ->values()
            ->map(fn (string $nombre, int $index) => [
                'id'     => $index + 1,
                'nombre' => $nombre,
            ])
            ->values();

        return response()->json($estados);
    }
}
