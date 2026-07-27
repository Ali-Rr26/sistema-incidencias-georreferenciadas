<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Manual duplicate-marking workflow (no auto-detection).
     *
     *   - `original_incident_id` is the canonical incident (the one
     *     other incidents are flagged as duplicating).
     *   - `duplicate_incident_id` is the new incident that the reporter
     *     believes is a duplicate of the original.
     *   - `status` goes through `pending` → `confirmed` or `rejected`
     *     via the staff-review endpoint. `confirmed` duplicates feed
     *     the canonical incident's `duplicates_count` and trigger the
     *     "is duplicate" banner on the duplicate's detail page.
     *   - `reviewed_by_user_id` / `reviewed_at` are nullable; set when
     *     staff hits the PATCH endpoint.
     *
     * Indexes:
     *   - composite (original_incident_id, status) for the public list
     *     that powers the duplicate sidebar of the canonical incident.
     *   - composite (duplicate_incident_id) for the "is this thing a
     *     duplicate of somebody?" lookup. We do NOT index by status here
     *     because the duplicate banner only cares about confirmed rows
     *     and there's a 1:1 between duplicate_incident_id and a confirmed
     *     link in practice.
     *   - partial unique on original_incident_id + duplicate_incident_id
     *     so the same (a,b) pair can never be marked twice (even across
     *     pending/confirmed status changes if a row is re-opened).
     */
    public function up(): void
    {
        Schema::create('incident_duplicates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('original_incident_id')->constrained('incidents')->cascadeOnDelete();
            $table->foreignId('duplicate_incident_id')->constrained('incidents')->cascadeOnDelete();
            $table->foreignId('reported_by_user_id')->constrained('users')->cascadeOnDelete();
            $table->text('reason')->nullable();
            $table->string('status')->default('pending');
            $table->foreignId('reviewed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->unique(['original_incident_id', 'duplicate_incident_id'], 'incident_duplicates_pair_unique');
            $table->index(['original_incident_id', 'status'], 'incident_duplicates_original_status_idx');
            $table->index('duplicate_incident_id', 'incident_duplicates_duplicate_idx');
        });

        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE incident_duplicates ADD CONSTRAINT incident_duplicates_status_check CHECK (status IN ('pending', 'confirmed', 'rejected'))");
        }
    }

    public function down(): void
    {
        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE incident_duplicates DROP CONSTRAINT IF EXISTS incident_duplicates_status_check');
        }

        Schema::dropIfExists('incident_duplicates');
    }
};
