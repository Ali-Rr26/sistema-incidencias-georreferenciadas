<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Domains\Comments\Models\Comment;
use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Locations\Models\Location;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Users\Models\User;
use Illuminate\Database\Seeder;
use MatanYadaev\EloquentSpatial\Objects\Point;

class MassIncidentSeeder extends Seeder
{
    /**
     * Generate a large, realistic dataset of incidents (+ comments) for
     * performance testing and UI demo purposes.
     *
     * Usage:
     *   php artisan db:seed --class=MassIncidentSeeder
     */
    private const int TOTAL = 1000;

    private const CITY_COORDS = [
        'EC-17-01' => [-0.2295,  -78.5249], // Quito
        'EC-09-01' => [-2.1894,  -79.8891], // Guayaquil
        'EC-01-01' => [-2.9001,  -79.0059], // Cuenca
        'EC-18-01' => [-1.2491,  -78.6269], // Ambato
        'EC-11-01' => [-3.9931,  -79.2042], // Loja
        'EC-05-01' => [-0.9352,  -78.6154], // Latacunga
        'EC-06-01' => [-1.6706,  -78.6470], // Riobamba
        'EC-13-01' => [-1.0546,  -80.4525], // Portoviejo
        'EC-07-01' => [-3.2672,  -79.9608], // Machala
        'EC-08-01' => [0.9683,  -79.6539], // Esmeraldas
        'EC-10-01' => [0.3515,  -78.1292], // Ibarra
        'EC-24-01' => [-2.2662,  -80.8581], // Santa Elena
    ];

    private const STATUSES = ['pending', 'in_progress', 'resolved'];

    private const PRIORITIES = ['low', 'medium', 'high'];

    /** Weighted distribution: index => weight */
    private const STATUS_WEIGHTS = [40, 30, 30];   // pending, in_progress, resolved

    private const PRIORITY_WEIGHTS = [20, 50, 30];  // low, medium, high

    /** Sample messages for comments */
    private const COMMENT_MESSAGES = [
        'Ya reporté esto hace dos semanas y sigue igual.',
        '¿Podrían darle prioridad? Es peligroso para los peatones.',
        'Gracias por la atención, se nota la mejora.',
        'El problema empeoró con las lluvias de ayer.',
        'Vinieron a revisar pero no hicieron nada.',
        'Solicito una inspección técnica lo antes posible.',
        'Mis vecinos también están afectados por esto.',
        '¿Hay algún número de seguimiento para este caso?',
        'Ya se solucionó, gracias por la gestión.',
        'Sigue igual, nadie ha venido a reparar.',
        'Esto lleva meses así, necesitamos una solución urgente.',
        'Afecta a toda la cuadra, por favor denle celeridad.',
        '¿Podrían enviar una cuadrilla esta semana?',
        'Ya pasaron 15 días y no hay novedades.',
        'Excelente servicio, quedó bien reparado.',
        'Hay niños que pasan por aquí, es riesgoso.',
        'Adjunto más fotos del estado actual.',
        'Ya hablé con el departamento y me dijeron que están en eso.',
        'El olor es insoportable, necesitamos acción ya.',
        'Muy conforme con la respuesta recibida.',
        '¿A qué hora pasarán a revisar? Necesito estar presente.',
        'Hay múltiples baches en la misma calle.',
        'La reparación duró una semana y ya volvió a romperse.',
        'Por favor confirmen recepción de este reporte.',
        'Los vecinos hicieron una colecta para los materiales.',
    ];

    public function run(): void
    {
        $categories = IncidentCategory::whereDoesntHave('children')->get();
        $locations = Location::whereIn('code', array_keys(self::CITY_COORDS))->get()->keyBy('code');
        $users = User::all();

        if ($categories->isEmpty()) {
            $this->command?->error('No leaf categories found. Run IncidentCategorySeeder first.');

            return;
        }

        $this->command?->info('Seeding '.self::TOTAL.' incidents...');
        $bar = $this->command?->getOutput()->createProgressBar(self::TOTAL);
        $bar?->start();

        $orgByCity = $this->buildOrgMap();

        $now = now();
        $incidents = [];

        for ($i = 0; $i < self::TOTAL; $i++) {
            $cityCode = $this->weightedRandomCity();
            $location = $locations->get($cityCode);
            if ($location === null) {
                $bar?->advance();

                continue;
            }

            $status = $this->weightedRandom(self::STATUSES, self::STATUS_WEIGHTS);
            $priority = $this->weightedRandom(self::PRIORITIES, self::PRIORITY_WEIGHTS);

            // Random date within the last 90 days
            $createdAt = (clone $now)->subDays(random_int(0, 90))
                ->setTime(random_int(0, 23), random_int(0, 59), random_int(0, 59));

            // Resolved incidents get a resolution date within a few days of creation
            $resolutionDate = null;
            if ($status === 'resolved') {
                $resolutionDate = (clone $createdAt)->addDays(random_int(1, 14));
            }

            [$lat, $lng] = self::CITY_COORDS[$cityCode];
            $latOffset = (random_int(-1500, 1500) / 100000);
            $lngOffset = (random_int(-1500, 1500) / 100000);

            $category = $categories->random();
            $user = $users->random();
            $orgId = $orgByCity[$cityCode] ?? null;

            $incidents[] = [
                'incident_category_id' => $category->id,
                'user_id' => $user->id,
                'location_id' => $location->id,
                'organization_id' => $orgId,
                'status' => $status,
                'priority' => $priority,
                'resolution_date' => $resolutionDate,
                'geom' => new Point($lat + $latOffset, $lng + $lngOffset, 4326),
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ];

            $bar?->advance();
        }

        // Batch insert for speed
        foreach (array_chunk($incidents, 100) as $chunk) {
            Incident::insert($chunk);
        }

        $bar?->finish();
        $this->command?->newLine();
        $this->command?->info(self::TOTAL.' incidents inserted.');

        // ─── Seed comments for ~30% of incidents ────────────────────
        $this->seedComments($users);
    }

    private function seedComments($users): void
    {
        $incidentIds = Incident::pluck('id');
        $commentCount = 0;
        $comments = [];

        foreach ($incidentIds as $incidentId) {
            // ~30% chance to have comments
            if (random_int(1, 100) > 30) {
                continue;
            }

            // 1 to 5 comments per incident
            $numComments = random_int(1, 5);

            // Base timestamp a bit after the incident was created
            $incident = Incident::find($incidentId);
            $base = $incident?->created_at ?? now()->subDays(30);

            for ($j = 0; $j < $numComments; $j++) {
                $message = self::COMMENT_MESSAGES[array_rand(self::COMMENT_MESSAGES)];
                $user = $users->random();
                $createdAt = (clone $base)->addHours($j * random_int(2, 48) + random_int(0, 60));

                $comments[] = [
                    'incident_id' => $incidentId,
                    'user_id' => $user->id,
                    'message' => $message,
                    'created_at' => $createdAt,
                    'updated_at' => $createdAt,
                ];

                $commentCount++;
            }
        }

        foreach (array_chunk($comments, 100) as $chunk) {
            Comment::insert($chunk);
        }

        $this->command?->info($commentCount.' comments inserted across '.$incidentIds->count().' incidents.');
    }

    private function buildOrgMap(): array
    {
        // Map city codes to organization IDs so incidents in a city
        // are assigned to that city's municipal GAD.
        $orgs = Organization::with('location')->get();

        $map = [];
        foreach ($orgs as $org) {
            $cityCode = $org->location?->code;
            if ($cityCode !== null && array_key_exists($cityCode, self::CITY_COORDS)) {
                // Prefer parent orgs over branches for organization_id
                if ($org->parent_id === null) {
                    $map[$cityCode] = $org->id;
                }
            }
        }

        return $map;
    }

    /**
     * Weighted distribution for status/priority.
     * Returns a random value from $items based on $weights.
     */
    private function weightedRandom(array $items, array $weights): string
    {
        $total = array_sum($weights);
        $rand = random_int(1, $total);

        $cumulative = 0;
        foreach ($items as $i => $item) {
            $cumulative += $weights[$i];
            if ($rand <= $cumulative) {
                return $item;
            }
        }

        return $items[0];
    }

    /**
     * Weighted city selection so larger cities get more incidents.
     */
    private function weightedRandomCity(): string
    {
        // Weights: Quito/Guayaquil ~5x, Cuenca/Ambato/Loja ~3x, rest ~1x
        $cities = array_keys(self::CITY_COORDS);
        $weights = [5, 5, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1];

        $total = array_sum($weights);
        $rand = random_int(1, $total);

        $cumulative = 0;
        foreach ($cities as $i => $city) {
            $cumulative += $weights[$i];
            if ($rand <= $cumulative) {
                return $city;
            }
        }

        return $cities[0];
    }
}
