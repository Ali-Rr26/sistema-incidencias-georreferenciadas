<?php

namespace Database\Seeders;

use App\Domains\Roles\Enums\UserRole;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class RoleSeeder extends Seeder
{
    private const ROLES = [
        ['id' => 1, 'name' => UserRole::AdminSistema->value],
        ['id' => 2, 'name' => UserRole::OperadorSistema->value],
        ['id' => 3, 'name' => UserRole::AdminOrganizacion->value],
        ['id' => 4, 'name' => UserRole::OperadorOrganizacion->value],
        ['id' => 5, 'name' => UserRole::Usuario->value],
    ];

    public function run(): void
    {
        foreach (self::ROLES as $role) {
            // `DB::table()->updateOrInsert()`, not `Role::query()->updateOrCreate()`:
            // `Role::$fillable = ['name']` excludes `id`, so the Eloquent
            // mass-assignment path silently dropped the explicit id on
            // create and let auto-increment assign whatever the sequence
            // happened to be at — wrong for these FK-target rows.
            // Surfaced by the SQLite → PostgreSQL test migration
            // (backend-tests-postgres-migration, issue #197): Postgres
            // SERIAL sequences persist across rolled-back transactions,
            // so the "first insert lands on id=N" coincidence that masked
            // this on SQLite no longer holds.
            DB::table('roles')->updateOrInsert(
                ['id' => $role['id']],
                ['name' => $role['name']],
            );

            $this->command?->info("Rol {$role['name']} creado/actualizado.");
        }

        $this->resyncIdSequence();
    }

    /**
     * Advances `roles_id_seq` past the highest pinned id.
     *
     * Raw inserts with an explicit `id` never touch PostgreSQL's serial
     * sequence. Without this, the very next `Role::create()` through the
     * app's real path (`RoleController::store()`) calls `nextval()`,
     * which would still return 1 and collide with the row this seeder
     * just pinned there — a real production defect, not just a test
     * artifact, surfaced by backend-tests-postgres-migration (#197).
     */
    private function resyncIdSequence(): void
    {
        if (DB::connection()->getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement(
            "select setval(pg_get_serial_sequence('roles', 'id'), (select max(id) from roles))"
        );
    }
}
