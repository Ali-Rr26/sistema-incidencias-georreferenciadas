<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * "Seguir" / follow — one row per (incident, user) pair.
     *
     * Drives the bulk-dispatch of notifications when a followed incident
     * gets a new comment or a status change. Same shape as me_too_reports
     * but a separate table so the two UX actions stay independent (a
     * "te la reporto" click does NOT subscribe the user — that would
     * surprise the citizen).
     */
    public function up(): void
    {
        Schema::create('incident_followers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('incident_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['incident_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('incident_followers');
    }
};
