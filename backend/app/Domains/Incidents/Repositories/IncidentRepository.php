<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Repositories;

use App\Domains\Incidents\Models\Incident;
use App\Domains\Shared\Repositories\Repository;

interface IncidentRepository extends Repository
{
    public function claim(int $id, int $userId): Incident;

    public function release(int $id): Incident;
}
