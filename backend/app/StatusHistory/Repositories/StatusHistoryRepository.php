<?php

declare(strict_types=1);

namespace App\StatusHistory\Repositories;

use App\Domains\Incidents\Models\Incident;
use App\StatusHistory\Models\StatusHistory;
use Illuminate\Support\Collection;

interface StatusHistoryRepository
{
    public function byIncident(int $incidentId): Collection;

    public function cambiarEstado(
        Incident $incident,
        string $newStatus,
        int $userId,
        ?string $comentario,
    ): StatusHistory;
}
