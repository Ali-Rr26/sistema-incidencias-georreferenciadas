<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Locations\Models\Location;
use App\Domains\Users\Models\User;
use Illuminate\Database\Seeder;
use MatanYadaev\EloquentSpatial\Objects\Point;

class IncidentSeeder extends Seeder
{
    /**
     * Approximate city center coordinates [latitude, longitude].
     * Used to generate Point geom for each incident.
     */
    private const CITY_COORDS = [
        'EC-17-01' => [-0.2295,  -78.5249], // Quito
        'EC-09-01' => [-2.1894,  -79.8891], // Guayaquil
        'EC-01-01' => [-2.9001,  -79.0059], // Cuenca
        'EC-18-01' => [-1.2491,  -78.6269], // Ambato
        'EC-11-01' => [-3.9931,  -79.2042], // Loja
    ];

    /**
     * Each entry references category by name, location by code, and user by email.
     * status + priority cover all combinations for meaningful test coverage.
     */
    private const INCIDENTS = [
        // Quito — pending
        ['category' => 'Baches y Hundimientos',       'location' => 'EC-17-01', 'priority' => 'high',   'status' => 'pending',     'user' => 'usuario1@test.com',   'resolution_date' => null],
        ['category' => 'Alumbrado Público',           'location' => 'EC-17-01', 'priority' => 'medium', 'status' => 'pending',     'user' => 'usuario2@test.com',   'resolution_date' => null],
        ['category' => 'Agua Potable',                'location' => 'EC-17-01', 'priority' => 'high',   'status' => 'in_progress', 'user' => 'usuario1@test.com',   'resolution_date' => null],
        ['category' => 'Construcciones Ilegales',     'location' => 'EC-17-01', 'priority' => 'low',    'status' => 'in_progress', 'user' => 'operador1@sistema.com', 'resolution_date' => null],
        ['category' => 'Vandalismo',                  'location' => 'EC-17-01', 'priority' => 'medium', 'status' => 'resolved',    'user' => 'usuario2@test.com',   'resolution_date' => '2026-06-10 14:00:00'],

        // Guayaquil
        ['category' => 'Alcantarillado',              'location' => 'EC-09-01', 'priority' => 'high',   'status' => 'pending',     'user' => 'usuario1@test.com',   'resolution_date' => null],
        ['category' => 'Semáforos Dañados',           'location' => 'EC-09-01', 'priority' => 'high',   'status' => 'in_progress', 'user' => 'operador2@sistema.com', 'resolution_date' => null],
        ['category' => 'Recolección de Residuos',     'location' => 'EC-09-01', 'priority' => 'medium', 'status' => 'resolved',    'user' => 'usuario2@test.com',   'resolution_date' => '2026-06-15 09:30:00'],
        ['category' => 'Accidentes de Tránsito',      'location' => 'EC-09-01', 'priority' => 'high',   'status' => 'resolved',    'user' => 'operador1@sistema.com', 'resolution_date' => '2026-06-18 16:00:00'],
        ['category' => 'Contaminación Ambiental',     'location' => 'EC-09-01', 'priority' => 'medium', 'status' => 'pending',     'user' => 'usuario1@test.com',   'resolution_date' => null],

        // Cuenca
        ['category' => 'Señalización Vial',           'location' => 'EC-01-01', 'priority' => 'low',    'status' => 'pending',     'user' => 'usuario2@test.com',   'resolution_date' => null],
        ['category' => 'Obras Abandonadas',           'location' => 'EC-01-01', 'priority' => 'medium', 'status' => 'in_progress', 'user' => 'operador1@sistema.com', 'resolution_date' => null],
        ['category' => 'Tala de Árboles',             'location' => 'EC-01-01', 'priority' => 'low',    'status' => 'resolved',    'user' => 'usuario1@test.com',   'resolution_date' => '2026-06-20 11:00:00'],
        ['category' => 'Robos y Hurtos',              'location' => 'EC-01-01', 'priority' => 'high',   'status' => 'in_progress', 'user' => 'usuario2@test.com',   'resolution_date' => null],
        ['category' => 'Red Eléctrica',               'location' => 'EC-01-01', 'priority' => 'high',   'status' => 'pending',     'user' => 'operador2@sistema.com', 'resolution_date' => null],

        // Ambato
        ['category' => 'Baches y Hundimientos',       'location' => 'EC-18-01', 'priority' => 'medium', 'status' => 'pending',     'user' => 'usuario1@test.com',   'resolution_date' => null],
        ['category' => 'Basureros Clandestinos',      'location' => 'EC-18-01', 'priority' => 'medium', 'status' => 'in_progress', 'user' => 'operador1@sistema.com', 'resolution_date' => null],
        ['category' => 'Veredas y Aceras Deterioradas', 'location' => 'EC-18-01', 'priority' => 'low',  'status' => 'resolved',    'user' => 'usuario2@test.com',   'resolution_date' => '2026-06-22 08:00:00'],

        // Loja
        ['category' => 'Agua Potable',                'location' => 'EC-11-01', 'priority' => 'high',   'status' => 'pending',     'user' => 'usuario1@test.com',   'resolution_date' => null],
        ['category' => 'Alumbrado Público',           'location' => 'EC-11-01', 'priority' => 'medium', 'status' => 'in_progress', 'user' => 'operador2@sistema.com', 'resolution_date' => null],
        ['category' => 'Vandalismo',                  'location' => 'EC-11-01', 'priority' => 'low',    'status' => 'resolved',    'user' => 'usuario2@test.com',   'resolution_date' => '2026-06-21 17:00:00'],
        ['category' => 'Señalización Vial',           'location' => 'EC-11-01', 'priority' => 'medium', 'status' => 'pending',     'user' => 'usuario1@test.com',   'resolution_date' => null],
    ];

    public function run(): void
    {
        $categories = IncidentCategory::whereDoesntHave('children')
            ->get()
            ->groupBy('name');

        $locations = Location::whereIn('code', array_keys(self::CITY_COORDS))
            ->get()
            ->keyBy('code');

        $users = User::all()->keyBy('email');

        foreach (self::INCIDENTS as $spec) {
            $category = $categories->get($spec['category'])?->first();
            $location = $locations->get($spec['location']);
            $user = $users->get($spec['user']);

            if (! $category || ! $location || ! $user) {
                $this->command?->warn("Skipping incident — missing: category=[{$spec['category']}] location=[{$spec['location']}] user=[{$spec['user']}]");

                continue;
            }

            [$lat, $lng] = self::CITY_COORDS[$spec['location']];

            // Small offset so points don't all stack on the same coordinate
            $latOffset = (random_int(-500, 500) / 100000);
            $lngOffset = (random_int(-500, 500) / 100000);

            Incident::create([
                'incident_category_id' => $category->id,
                'user_id' => $user->id,
                'location_id' => $location->id,
                'status' => $spec['status'],
                'priority' => $spec['priority'],
                'resolution_date' => $spec['resolution_date'],
                'geom' => new Point($lat + $latOffset, $lng + $lngOffset, 4326),
            ]);
        }

        $this->command?->info(count(self::INCIDENTS).' incidents seeded.');
    }
}
