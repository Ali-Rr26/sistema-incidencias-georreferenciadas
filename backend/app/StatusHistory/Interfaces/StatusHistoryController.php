<?php

declare(strict_types=1);

namespace App\StatusHistory\Interfaces;

use App\Domains\Incidents\Models\Incident;
use App\Domains\Incidents\Repositories\IncidentRepository;
use App\StatusHistory\Interfaces\Requests\UpdateEstadoRequest;
use App\StatusHistory\Interfaces\Resources\StatusHistoryResource;
use App\StatusHistory\Repositories\StatusHistoryRepository;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Routing\Controller;

class StatusHistoryController extends Controller
{
    private const ESTADO_LABELS = [
        Incident::STATUS_PENDING     => 'Pendiente',
        Incident::STATUS_IN_PROGRESS => 'En Proceso',
        Incident::STATUS_RESOLVED    => 'Resuelto',
        Incident::STATUS_CLOSED      => 'Cerrado',
    ];

    private const ESTADO_MAP = [
        1 => Incident::STATUS_PENDING,
        2 => Incident::STATUS_IN_PROGRESS,
        3 => Incident::STATUS_RESOLVED,
        4 => Incident::STATUS_CLOSED,
    ];

    public function __construct(
        private readonly StatusHistoryRepository $statusHistory,
        private readonly IncidentRepository $incidents,
    ) {}

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

    public function index(Request $request, int $incidentId): JsonResponse
    {
        $incident = $this->incidents->findById($incidentId);

        if ($incident === null) {
            return response()->json(
                ['message' => 'Incidencia no encontrada'],
                Response::HTTP_NOT_FOUND,
            );
        }

        $historial = $this->statusHistory->byIncident($incidentId);

        return response()->json([
            'data' => StatusHistoryResource::collection($historial),
        ]);
    }

    public function updateEstado(UpdateEstadoRequest $request, int $incidentId): JsonResponse
    {
        $incident = $this->incidents->findById($incidentId);

        if ($incident === null) {
            return response()->json(
                ['message' => 'Incidencia no encontrada'],
                Response::HTTP_NOT_FOUND,
            );
        }

        $newStatus = self::ESTADO_MAP[$request->integer('estado_id')];

        if ($incident->status->value === $newStatus) {
            return response()->json(
                ['message' => 'La incidencia ya tiene ese estado'],
                Response::HTTP_UNPROCESSABLE_ENTITY,
            );
        }

        if (! Incident::isValidTransition($incident->status->value, $newStatus)) {
            return response()->json(
                ['message' => "Transición de estado no permitida: {$incident->status->value} → {$newStatus}"],
                Response::HTTP_UNPROCESSABLE_ENTITY,
            );
        }

        $this->statusHistory->cambiarEstado(
            $incident,
            $newStatus,
            $request->user()->id,
            $request->input('comentario'),
        );

        return response()->json(['message' => 'Estado actualizado correctamente']);
    }
}
