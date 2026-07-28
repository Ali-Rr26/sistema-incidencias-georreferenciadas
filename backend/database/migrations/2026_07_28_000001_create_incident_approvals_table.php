<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('incident_approvals', function (Blueprint $table) {
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

            // One decision per incident. This is the concurrency guard:
            // IncidentApprovalService also locks the incident row, but the
            // unique index is what makes a double decision impossible even
            // if a future caller bypasses the service.
            $table->unique('incident_id', 'incident_approvals_incident_id_unique');
        });

        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE incident_approvals ADD CONSTRAINT incident_approvals_decision_check CHECK (decision IN ('approved', 'rejected'))");
            DB::statement("COMMENT ON TABLE incident_approvals IS 'Registro inmutable de la decisión del admin sobre una incidencia resuelta'");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('incident_approvals');
    }
};
