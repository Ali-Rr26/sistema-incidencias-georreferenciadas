<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Widen the `incidents.status` CHECK constraint(s) to include the new
 * terminal `closed` status introduced by WU1 of the
 * `incident-approval-workflow` change.
 *
 * Background:
 *  - The constraint was originally named `incidents_status_check` by the
 *    incident create migration
 *    (`2026_06_15_000005_create_incidents_table.php:33`).
 *  - Subsequent migrations (`2026_06_29_000007_*`, `2026_07_08_000002_*`)
 *    use the same name when altering the allowed list.
 *  - The referential integrity migration
 *    (`2026_07_26_165347_add_referential_integrity_constraints.php:48`)
 *    ADDED A SECOND named constraint `chk_incident_status` covering the
 *    same column. Both constraints are evaluated by Postgres on insert
 *    and update; the WU1 widening must therefore touch both to be
 *    effective.
 *  - WU1 introduces `IncidentStatus::Closed = 'closed'` (see enum change
 *    in `IncidentStatus.php`) as a terminal state reachable only via
 *    admin approval (proposal §"Backend" point 1, design §4.1).
 *
 * The `up()` is idempotent: `DROP CONSTRAINT IF EXISTS` then
 * `ADD CONSTRAINT`. This is consistent with sibling migrations and lets
 * the migration re-run cleanly in environments where the constraint was
 * already recreated.
 *
 * The `down()` reverses to the 3-state constraint for both names. It
 * guards on rows already in `closed` so a rollback can only proceed on a
 * clean dataset, mirroring the rollback safety policy of the previous
 * publicador removal migration.
 *
 * Why two constraints: documented in the design §4.1, the named
 * `incidents_status_check` was the project's historical convention; the
 * later referential-integrity migration added a parallel `chk_*` pair
 * without dropping the original. WU1 does not unify them (out of scope)
 * but it does keep both aligned so the WU1 enum change is honoured at
 * the DB layer.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::connection()->getDriverName() === 'sqlite') {
            return;
        }

        // Legacy named constraint (created by the original incident table
        // migration and re-asserted by the publicador-removal migration).
        DB::statement('ALTER TABLE incidents DROP CONSTRAINT IF EXISTS incidents_status_check');
        DB::statement(
            'ALTER TABLE incidents ADD CONSTRAINT incidents_status_check '
            ."CHECK (status IN ('pending', 'in_progress', 'resolved', 'closed'))",
        );

        // Parallel constraint introduced by the referential integrity
        // migration (`2026_07_26_165347_add_referential_integrity_constraints.php`).
        // Must be widened too, otherwise inserts with `status='closed'`
        // will fail this constraint even after the legacy one is updated.
        DB::statement('ALTER TABLE incidents DROP CONSTRAINT IF EXISTS chk_incident_status');
        DB::statement(
            'ALTER TABLE incidents ADD CONSTRAINT chk_incident_status '
            ."CHECK (status IN ('pending', 'in_progress', 'resolved', 'closed'))",
        );
    }

    public function down(): void
    {
        if (DB::connection()->getDriverName() === 'sqlite') {
            return;
        }

        if (DB::table('incidents')->where('status', 'closed')->exists()) {
            throw new RuntimeException(
                'Cannot rollback: existen incidencias en estado closed. '
                .'Resuélvalas o reasignelas antes de hacer down().',
            );
        }

        DB::statement('ALTER TABLE incidents DROP CONSTRAINT IF EXISTS incidents_status_check');
        DB::statement(
            'ALTER TABLE incidents ADD CONSTRAINT incidents_status_check '
            ."CHECK (status IN ('pending', 'in_progress', 'resolved'))",
        );

        DB::statement('ALTER TABLE incidents DROP CONSTRAINT IF EXISTS chk_incident_status');
        DB::statement(
            'ALTER TABLE incidents ADD CONSTRAINT chk_incident_status '
            ."CHECK (status IN ('pending', 'in_progress', 'resolved'))",
        );
    }
};
