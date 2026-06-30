<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Incidents\Enums\IncidentPriority;
use App\Domains\Incidents\Enums\IncidentStatus;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Incidents\Models\IncidentVerification;
use App\Domains\Locations\Models\Location;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Roles\Enums\UserRole;
use App\Domains\Roles\Models\Role;
use App\Domains\Users\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use MatanYadaev\EloquentSpatial\Objects\Point;

class MultitenantFeatSeeder extends Seeder
{
    private const CITY_COORDS = [
        'EC-17-01' => [-0.2295,  -78.5249], // Quito
        'EC-09-01' => [-2.1894,  -79.8891], // Guayaquil
        'EC-01-01' => [-2.9001,  -79.0059], // Cuenca
        'EC-18-01' => [-1.2491,  -78.6269], // Ambato
        'EC-11-01' => [-3.9931,  -79.2042], // Loja
    ];

    public function run(): void
    {
        $this->command?->info('Iniciando Seeder para Multitenant y RBAC...');

        // 1. Asegurar la existencia de los Roles (incluyendo Publicador)
        $roleMap = [];
        $rolesToSeed = [
            ['id' => 1, 'name' => UserRole::AdminSistema->value],
            ['id' => 2, 'name' => UserRole::OperadorSistema->value],
            ['id' => 3, 'name' => UserRole::AdminOrganizacion->value],
            ['id' => 4, 'name' => UserRole::OperadorOrganizacion->value],
            ['id' => 5, 'name' => UserRole::Usuario->value],
            ['id' => 6, 'name' => UserRole::Publicador->value],
        ];

        foreach ($rolesToSeed as $r) {
            $role = Role::query()->updateOrCreate(['id' => $r['id']], $r);
            $roleMap[$r['name']] = $role->id;
        }
        $this->command?->info('Roles validados/creados.');

        // 2. Buscar o crear Usuario Ciudadano para reportar incidencias
        $ciudadano = User::query()->updateOrCreate(
            ['email' => 'ciudadano.test@incidencias.com'],
            [
                'role_id' => $roleMap[UserRole::Usuario->value],
                'password' => Hash::make('Ciudadano123!'),
                'first_name' => 'Juan',
                'last_name' => 'Pueblo',
                'organization_id' => null,
            ]
        );

        // 3. Definición de 5 organizaciones con sus categorías asignadas y códigos de ubicación
        $orgConfigs = [
            [
                'name' => 'GAD Municipal de Quito — Obras Viales',
                'location_code' => 'EC-17-01', // Quito
                'category_name' => 'Baches y Hundimientos',
                'max_active_claims' => 5,
            ],
            [
                'name' => 'GAD Municipal de Guayaquil — Agua y Saneamiento',
                'location_code' => 'EC-09-01', // Guayaquil
                'category_name' => 'Agua Potable',
                'max_active_claims' => 3,
            ],
            [
                'name' => 'GAD Municipal de Cuenca — Seguridad Ciudadana',
                'location_code' => 'EC-01-01', // Cuenca
                'category_name' => 'Robos y Hurtos',
                'max_active_claims' => 8,
            ],
            [
                'name' => 'GAD Municipal de Ambato — Medio Ambiente',
                'location_code' => 'EC-18-01', // Ambato
                'category_name' => 'Basureros Clandestinos',
                'max_active_claims' => 4,
            ],
            [
                'name' => 'GAD Municipal de Loja — Control Urbano',
                'location_code' => 'EC-11-01', // Loja
                'category_name' => 'Construcciones Ilegales',
                'max_active_claims' => 5,
            ],
        ];

        foreach ($orgConfigs as $config) {
            $location = Location::where('code', $config['location_code'])->first();
            if ($location === null) {
                $this->command?->warn("Ubicación [{$config['location_code']}] no encontrada. Saltando [{$config['name']}].");

                continue;
            }

            // Buscar categoría asignada
            $category = IncidentCategory::where('name', $config['category_name'])->first();
            if ($category === null) {
                // Crear si no existe
                $parent = IncidentCategory::firstOrCreate(['name' => 'General', 'parent_id' => null]);
                $category = IncidentCategory::firstOrCreate([
                    'name' => $config['category_name'],
                    'parent_id' => $parent->id,
                ]);
            }

            // Crear la Organización
            $org = Organization::query()->updateOrCreate(
                ['name' => $config['name']],
                [
                    'location_id' => $location->id,
                    'incident_category_id' => $category->id,
                    'max_active_claims' => $config['max_active_claims'],
                ]
            );

            $this->command?->info("Organización creada/actualizada: [{$org->name}] asociada a la categoría [{$category->name}]");

            // Crear usuarios correspondientes a esta organización
            $slug = Str::slug($org->name);

            // Admin de Org
            $adminEmail = "admin.{$slug}@incidencias.com";
            User::query()->updateOrCreate(
                ['email' => $adminEmail],
                [
                    'role_id' => $roleMap[UserRole::AdminOrganizacion->value],
                    'organization_id' => $org->id,
                    'password' => Hash::make('Admin123!'),
                    'first_name' => 'Admin',
                    'last_name' => $org->name,
                ]
            );

            // Operador de Org
            $operatorEmail = "operador.{$slug}@incidencias.com";
            $operator = User::query()->updateOrCreate(
                ['email' => $operatorEmail],
                [
                    'role_id' => $roleMap[UserRole::OperadorOrganizacion->value],
                    'organization_id' => $org->id,
                    'password' => Hash::make('Operador123!'),
                    'first_name' => 'Operador',
                    'last_name' => $org->name,
                ]
            );

            // Publicador de Org
            $publicadorEmail = "publicador.{$slug}@incidencias.com";
            $publicador = User::query()->updateOrCreate(
                ['email' => $publicadorEmail],
                [
                    'role_id' => $roleMap[UserRole::Publicador->value],
                    'organization_id' => $org->id,
                    'password' => Hash::make('Publicador123!'),
                    'first_name' => 'Publicador',
                    'last_name' => $org->name,
                ]
            );

            $this->command?->info('  Usuarios de la org creados (Admin, Operador, Publicador).');

            // 4. Crear casos de incidencias para esta Organización
            $coords = self::CITY_COORDS[$config['location_code']];
            $lat = $coords[0];
            $lng = $coords[1];

            // Pequeños offsets para no apilar las coordenadas
            $latOffset = fn () => (random_int(-100, 100) / 10000);
            $lngOffset = fn () => (random_int(-100, 100) / 10000);

            // Caso 1: Incidencia nueva (Pública, sin organización, elegible para verificación)
            // Esto significa que coincide con la categoría y la ubicación de la org, pero aún no tiene organization_id ni verificación.
            Incident::create([
                'incident_category_id' => $category->id,
                'user_id' => $ciudadano->id,
                'location_id' => $location->id,
                'title' => "Incidencia pendiente de verificación: {$config['category_name']} en {$location->name}",
                'description' => "Reporte ciudadano de prueba de {$config['category_name']} para verificar scoping.",
                'status' => IncidentStatus::Pending,
                'priority' => IncidentPriority::Medium,
                'geom' => new Point($lat + $latOffset(), $lng + $lngOffset(), 4326),
                'organization_id' => null,
                'claimed_by' => null,
            ]);

            // Caso 2: Incidencia ya confirmada pero pendiente de asignarse a un operador (PendingOperator)
            $incidentConfirmed = Incident::create([
                'incident_category_id' => $category->id,
                'user_id' => $ciudadano->id,
                'location_id' => $location->id,
                'title' => "Incidencia asignada a la Org y esperando operador: {$config['category_name']} en {$location->name}",
                'description' => 'Confirmada por el publicador. Lista para ser reclamada por un operador.',
                'status' => IncidentStatus::PendingOperator,
                'priority' => IncidentPriority::High,
                'geom' => new Point($lat + $latOffset(), $lng + $lngOffset(), 4326),
                'organization_id' => $org->id,
                'claimed_by' => null,
            ]);

            // Registrar la verificación en la auditoría
            IncidentVerification::create([
                'incident_id' => $incidentConfirmed->id,
                'verified_by' => $publicador->id,
                'organization_id' => $org->id,
                'verified_at' => now(),
            ]);

            // Caso 3: Incidencia reclamada por el Operador de la Org (In Progress)
            $incidentClaimed = Incident::create([
                'incident_category_id' => $category->id,
                'user_id' => $ciudadano->id,
                'location_id' => $location->id,
                'title' => "Incidencia en progreso: {$config['category_name']} en {$location->name}",
                'description' => 'El operador ya la reclamó y está trabajando en la resolución.',
                'status' => IncidentStatus::InProgress,
                'priority' => IncidentPriority::Medium,
                'geom' => new Point($lat + $latOffset(), $lng + $lngOffset(), 4326),
                'organization_id' => $org->id,
                'claimed_by' => $operator->id,
                'claimed_at' => now(),
            ]);

            IncidentVerification::create([
                'incident_id' => $incidentClaimed->id,
                'verified_by' => $publicador->id,
                'organization_id' => $org->id,
                'verified_at' => now()->subHours(2),
            ]);

            // Caso 4: Incidencia ya resuelta por la Org (Resolved)
            $incidentResolved = Incident::create([
                'incident_category_id' => $category->id,
                'user_id' => $ciudadano->id,
                'location_id' => $location->id,
                'title' => "Incidencia resuelta: {$config['category_name']} en {$location->name}",
                'description' => 'Se solucionó el problema reportado de manera exitosa.',
                'status' => IncidentStatus::Resolved,
                'priority' => IncidentPriority::Low,
                'geom' => new Point($lat + $latOffset(), $lng + $lngOffset(), 4326),
                'organization_id' => $org->id,
                'claimed_by' => $operator->id,
                'claimed_at' => now()->subDay(),
                'resolution_date' => now(),
            ]);

            IncidentVerification::create([
                'incident_id' => $incidentResolved->id,
                'verified_by' => $publicador->id,
                'organization_id' => $org->id,
                'verified_at' => now()->subDays(2),
            ]);

            $this->command?->info('  Incidencias creadas (Pendiente, Esperando Operador, En Progreso, Resuelta).');
        }

        $this->command?->info('Seeder completado exitosamente.');
    }
}
