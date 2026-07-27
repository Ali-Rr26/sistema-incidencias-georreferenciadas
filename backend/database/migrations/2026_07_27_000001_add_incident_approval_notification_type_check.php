<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check');
        DB::statement("ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN ('claim', 'assignment', 'assigned', 'status_change', 'comment', 'legacy', 'incidencia_atendida_para_aprobacion'))");
    }

    /**
     * Intentionally irreversible.
     *
     * After this migration runs in production, rows with
     * `type = 'incidencia_atendida_para_aprobacion'` will exist. Recreating
     * the previous CHECK constraint (without that value) would fail because
     * existing rows would violate it. Two safe paths exist:
     *
     *  - drop the constraint and leave the column unconstrained (data loss
     *    of the integrity guarantee; NOT recommended), or
     *  - leave the new constraint in place (the option we choose here).
     *
     * If a future migration needs to retire the approval type entirely, it
     * must first migrate or delete existing rows, then drop or update the
     * constraint in a single transaction.
     */
    public function down(): void
    {
        // No-op. See docblock above.
    }
};
