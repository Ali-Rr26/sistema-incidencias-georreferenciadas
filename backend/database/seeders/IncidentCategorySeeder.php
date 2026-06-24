<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Organizations\Models\Organization;
use Illuminate\Database\Seeder;

class IncidentCategorySeeder extends Seeder
{
    /**
     * Category tree applied to every organization.
     * Structure: [ parent_name => [child_name, ...] ]
     */
    private const CATEGORY_TREE = [
        'Infraestructura Vial' => [
            'Baches y Hundimientos',
            'Semáforos Dañados',
            'Señalización Vial',
            'Alumbrado Público',
        ],
        'Servicios Básicos' => [
            'Agua Potable',
            'Alcantarillado',
            'Recolección de Residuos',
            'Red Eléctrica',
        ],
        'Seguridad Ciudadana' => [
            'Robos y Hurtos',
            'Vandalismo',
            'Accidentes de Tránsito',
        ],
        'Medio Ambiente' => [
            'Contaminación Ambiental',
            'Tala de Árboles',
            'Basureros Clandestinos',
        ],
        'Obras e Infraestructura' => [
            'Construcciones Ilegales',
            'Obras Abandonadas',
            'Veredas y Aceras Deterioradas',
        ],
    ];

    public function run(): void
    {
        $organizations = Organization::all();

        if ($organizations->isEmpty()) {
            $this->command?->warn('No organizations found — run OrganizationSeeder first.');
            return;
        }

        foreach ($organizations as $organization) {
            $this->command?->info("Seeding categories for [{$organization->name}]...");

            foreach (self::CATEGORY_TREE as $parentName => $children) {
                $parent = IncidentCategory::updateOrCreate(
                    [
                        'organization_id' => $organization->id,
                        'name'            => $parentName,
                        'parent_id'       => null,
                    ],
                    [],
                );

                foreach ($children as $childName) {
                    IncidentCategory::updateOrCreate(
                        [
                            'organization_id' => $organization->id,
                            'name'            => $childName,
                            'parent_id'       => $parent->id,
                        ],
                        [],
                    );
                }
            }
        }
    }
}
