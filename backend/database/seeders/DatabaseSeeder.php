<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        $this->call([
            RoleSeeder::class,
            // UserSeeder creates one Admin + one Operador per organization
            // (e.g. operador.gad-municipal-del-canton-quito@organizacion.com),
            // so it must run AFTER OrganizationSeeder. Previously this was
            // ordered the wrong way, leaving orgs without their operators.
            EcuadorLocationSeeder::class,
            OrganizationSeeder::class,
            UserSeeder::class,
            PermissionSeeder::class,
            RolePermissionSeeder::class,
            MenuSeeder::class,
            IncidentCategorySeeder::class,
            IncidentSeeder::class,
        ]);

        // Uncomment for performance / demo testing (creates 1000 incidents + comments):
        // $this->call(MassIncidentSeeder::class);

        // Uncomment to seed ~25 realistic incidents in the Santa Elena province
        // (cantons: Santa Elena, La Libertad, Salinas). Idempotent on title — safe
        // to re-run. Useful for map demo without the 1000-incident mass seed.
        // $this->call(SantaElenaIncidentSeeder::class);
    }
}
