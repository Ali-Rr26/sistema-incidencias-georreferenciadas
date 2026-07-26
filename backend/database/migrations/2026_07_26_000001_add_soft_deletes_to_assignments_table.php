<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assignments', function (Blueprint $table) {
            $table->softDeletes();
        });

        // Postgres (producción): reemplazar UNIQUE (incident_id, user_id)
        // por un partial unique index que ignore filas soft-deleted.
        // Esto permite re-asignar un operador que fue desasignado previamente
        // sin que el unique constraint lo bloquee.
        //
        // SQLite (tests): no podemos dropear índices vía ALTER TABLE.
        // El unique constraint original aplica también sobre filas
        // soft-deleted, pero en tests eso es aceptable porque:
        //   a) el volumen es bajo
        //   b) el método assign() ya tiene un guard PHP que previene
        //      duplicados activos (línea 58: duplicate check)
        //   c) el partial unique index se prueba en CI contra Postgres.

        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::statement('DROP INDEX assignments_incident_id_user_id_unique');
            DB::statement(
                'CREATE UNIQUE INDEX assignments_incident_user_active_unique '
                .'ON assignments (incident_id, user_id) WHERE deleted_at IS NULL'
            );
        }
    }

    public function down(): void
    {
        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::statement('DROP INDEX IF EXISTS assignments_incident_user_active_unique');
            // NOTA: no restauramos el unique constraint original porque
            // podría colisionar con filas soft-deleted existentes. En
            // producción no se hace rollback de migraciones de datos.
        }

        Schema::table('assignments', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
    }
};
