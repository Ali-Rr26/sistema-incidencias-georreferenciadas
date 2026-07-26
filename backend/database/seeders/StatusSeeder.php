<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Domains\Incidents\Enums\IncidentStatus;
use App\Domains\Statuses\Models\Status;
use Illuminate\Database\Seeder;

class StatusSeeder extends Seeder
{
    /**
     * Seed the statuses table from the IncidentStatus enum.
     */
    public function run(): void
    {
        $statuses = [
            ['nombre' => 'Pendiente', 'valor' => IncidentStatus::Pending->value],
            ['nombre' => 'En proceso', 'valor' => IncidentStatus::InProgress->value],
            ['nombre' => 'Resuelto', 'valor' => IncidentStatus::Resolved->value],
        ];

        foreach ($statuses as $status) {
            Status::firstOrCreate(
                ['valor' => $status['valor']],
                ['nombre' => $status['nombre'], 'activo' => true]
            );
        }
    }
}
