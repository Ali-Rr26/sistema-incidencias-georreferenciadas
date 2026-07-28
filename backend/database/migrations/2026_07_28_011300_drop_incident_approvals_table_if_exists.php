<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * WU2 (PR-1b) — drop the legacy `incident_approvals` table.
 *
 * Background (design §4.2, ADR-1): commit `86a4d45a` introduced a table
 * `incident_approvals` to persist admin approval decisions as a separate
 * aggregate. The `incident-approval-workflow` proposal discards that refactor:
 * the decision is now expressed as a state transition on `incidents` +
 * `processed_at` on the source `notifications` row. The 86a4d45a commit was
 * reverted in `62c8ddfd`, so fresh deployments never see the table.
 *
 * This migration exists for environments that already deployed the refactor:
 * their DB still has `incident_approvals` even after the revert landed. The
 * `up()` uses `Schema::dropIfExists('incident_approvals')` for idempotency —
 * safe to run whether or not the table is present.
 *
 * The `down()` recreates the original schema verbatim from `86a4d45a` so a
 * future rollback (e.g. if the new service has to be reverted) can put the
 * DB back exactly as it was. The CHECK constraint, the unique index on
 * `incident_id` and the FK cascade behaviour all match the original migration
 * `2026_07_28_000001_create_incident_approvals_table.php` — we re-stated it
 * here deliberately so a down() doesn't require pulling the original migration
 * out of git history.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('incident_approvals');
    }

    public function down(): void
    {
        Schema::create('incident_approvals', function (Blueprint $table): void {
            $table->id();

            $table->foreignId('incident_id')
                ->constrained('incidents')
                ->cascadeOnDelete();

            $table->foreignId('decided_by')
                ->constrained('users')
                ->cascadeOnDelete();

            $table->string('decision', 16);
            $table->text('rejection_reason')->nullable();

            $table->foreignId('organization_id')
                ->constrained('organizations')
                ->cascadeOnDelete();

            $table->timestamp('decided_at');

            // One decision per incident. Mirrors the original migration:
            // the unique index is what makes a double decision impossible
            // even if a future caller bypasses the service. Kept verbatim so
            // a down() doesn't change the schema semantics.
            $table->unique('incident_id', 'incident_approvals_incident_id_unique');
        });

        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE incident_approvals ADD CONSTRAINT incident_approvals_decision_check CHECK (decision IN ('approved', 'rejected'))");
            DB::statement("COMMENT ON TABLE incident_approvals IS 'Registro inmutable de la decisión del admin sobre una incidencia resuelta'");
        }
    }
};
