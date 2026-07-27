<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * "Yo también reporto" — one row per (incident, user) pair.
     *
     * The unique composite index enforces "at most one me-too per user
     * per incident" at the database level (defense-in-depth on top of
     * the application-level `firstOrCreate`/`where delete` logic in
     * MeTooController). Cascade on incident/user delete so we never
     * leave orphaned reports.
     *
     * Only `created_at` is tracked: me-too is a singular action and
     * the soft-delete semantics would only complicate the duplicate
     * unique constraint (PG partial unique with `deleted_at` is doable
     * but not needed yet). The `deleted_at` is intentionally omitted.
     */
    public function up(): void
    {
        Schema::create('me_too_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('incident_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['incident_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('me_too_reports');
    }
};
