<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Domains\Locations\Models\Location;
use App\Domains\Organizations\Models\Organization;
use Illuminate\Database\Seeder;

class OrganizationSeeder extends Seeder
{
    /** [location_code => organization_name] */
    private const ORGANIZATIONS = [
        'EC-17-01' => 'GAD Municipal del Cantón Quito',
        'EC-09-01' => 'GAD Municipal del Cantón Guayaquil',
        'EC-01-01' => 'GAD Municipal del Cantón Cuenca',
        'EC-18-01' => 'GAD Municipal del Cantón Ambato',
        'EC-11-01' => 'GAD Municipal del Cantón Loja',
    ];

    public function run(): void
    {
        foreach (self::ORGANIZATIONS as $locationCode => $name) {
            $location = Location::where('code', $locationCode)->first();

            if ($location === null) {
                $this->command?->warn("Location [{$locationCode}] not found — skipping [{$name}].");
                continue;
            }

            Organization::updateOrCreate(
                ['name' => $name],
                ['location_id' => $location->id],
            );

            $this->command?->info("Organization [{$name}] seeded.");
        }
    }
}
