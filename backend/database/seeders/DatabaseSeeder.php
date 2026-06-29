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
            UserSeeder::class,
            PermissionSeeder::class,
            RolePermissionSeeder::class,
            MenuSeeder::class,
            EcuadorLocationSeeder::class,
            OrganizationSeeder::class,
            IncidentCategorySeeder::class,
            IncidentSeeder::class,
        ]);

        // Uncomment for performance / demo testing (creates 1000 incidents + comments):
        // $this->call(MassIncidentSeeder::class);
    }
}
