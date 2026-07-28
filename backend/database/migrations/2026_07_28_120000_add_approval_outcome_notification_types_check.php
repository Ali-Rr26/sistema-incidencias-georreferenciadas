<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Adds `resolucion_aprobada` / `resolucion_rechazada` to the
     * `notifications_type_check` constraint.
     *
     * Follows the pattern of
     * 2026_07_27_000001_add_incident_approval_notification_type_check.
     */
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check');
        DB::statement("ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN ('claim', 'assignment', 'assigned', 'status_change', 'comment', 'legacy', 'incidencia_atendida_para_aprobacion', 'resolucion_aprobada', 'resolucion_rechazada'))");
    }

    /**
     * Restores the previous constraint, deleting the rows that would violate
     * it first.
     *
     * The sibling migration for `incidencia_atendida_para_aprobacion` chose a
     * no-op `down()` to avoid destroying data. Here the rows are disposable:
     * `resolucion_aprobada` / `resolucion_rechazada` are transient user
     * notices, and the authoritative record of the decision lives elsewhere
     * (the incident status transition, `status_history`, and the rejection
     * comment on the incident thread). Deleting them on rollback loses no
     * audit trail, so a symmetric `down()` is safe and keeps the migration
     * reversible.
     */
    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::table('notifications')
            ->whereIn('type', ['resolucion_aprobada', 'resolucion_rechazada'])
            ->delete();

        DB::statement('ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check');
        DB::statement("ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN ('claim', 'assignment', 'assigned', 'status_change', 'comment', 'legacy', 'incidencia_atendida_para_aprobacion'))");
    }
};
