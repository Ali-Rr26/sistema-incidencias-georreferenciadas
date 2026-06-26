<?php

declare(strict_types=1);

namespace App\StatusHistory\Repositories;

use App\Domains\Incidents\Models\Incident;
use App\StatusHistory\Models\StatusHistory;

interface StatusHistoryRepository
{
    public function cambiarEstado(
        Incident $incident,
        string $newStatus,
        int $userId,
        ?string $comentario,
    ): StatusHistory;
}
