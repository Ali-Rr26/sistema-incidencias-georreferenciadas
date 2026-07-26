<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add query optimization indexes for dashboard filters and common queries.
     *
     * Indexes added:
     * - status: for dashboard state filtering
     * - organization_id + status: for org-scoped queries
     * - resolution_date: for time-based queries (WHERE resolution_date IS NOT NULL)
     * - location_id, incident_category_id: for FK lookups
     * - locations.parent_id: for hierarchy queries
     * - status_history, comments: for relationship lookups
     */
    public function up(): void
    {
        Schema::table('incidents', function (Blueprint $table) {
            $table->index('status', 'idx_incidents_status');
            $table->index(['organization_id', 'status'], 'idx_incidents_org_status');
            $table->index('location_id', 'idx_incidents_location_id');
            $table->index('incident_category_id', 'idx_incidents_category_id');
            $table->index('user_id', 'idx_incidents_user_id');
            $table->index('resolution_date', 'idx_incidents_resolution_date');
        });

        Schema::table('locations', function (Blueprint $table) {
            $table->index('parent_id', 'idx_locations_parent_id');
        });

        Schema::table('status_history', function (Blueprint $table) {
            $table->index('incident_id', 'idx_status_history_incident_id');
            $table->index('user_id', 'idx_status_history_user_id');
        });

        Schema::table('comments', function (Blueprint $table) {
            $table->index('incident_id', 'idx_comments_incident_id');
            $table->index('user_id', 'idx_comments_user_id');
        });

        Schema::table('assignments', function (Blueprint $table) {
            $table->index('incident_id', 'idx_assignments_incident_id');
            $table->index('user_id', 'idx_assignments_user_id');
        });
    }

    public function down(): void
    {
        Schema::table('incidents', function (Blueprint $table) {
            $table->dropIndex('idx_incidents_status');
            $table->dropIndex('idx_incidents_org_status');
            $table->dropIndex('idx_incidents_location_id');
            $table->dropIndex('idx_incidents_category_id');
            $table->dropIndex('idx_incidents_user_id');
            $table->dropIndex('idx_incidents_resolution_date');
        });

        Schema::table('locations', function (Blueprint $table) {
            $table->dropIndex('idx_locations_parent_id');
        });

        Schema::table('status_history', function (Blueprint $table) {
            $table->dropIndex('idx_status_history_incident_id');
            $table->dropIndex('idx_status_history_user_id');
        });

        Schema::table('comments', function (Blueprint $table) {
            $table->dropIndex('idx_comments_incident_id');
            $table->dropIndex('idx_comments_user_id');
        });

        Schema::table('assignments', function (Blueprint $table) {
            $table->dropIndex('idx_assignments_incident_id');
            $table->dropIndex('idx_assignments_user_id');
        });
    }
};
