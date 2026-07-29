<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Add approval/rejection audit columns to the `incidents` table.
 *
 * Supports the admin-approval workflow (sc-123): when an incident is approved
 * or rejected by an administrator, the user who made the decision and the
 * timestamp are recorded. The `rejection_reason` stores the admin's optional
 * note explaining the rejection.
 *
 * Partial index on `approved_at` WHERE NOT NULL optimises the common query
 * pattern: "show me incidents that have been decided but not yet closed".
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('incidents', function (Blueprint $table): void {
            $table->foreignId('approved_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamp('approved_at')->nullable();

            $table->foreignId('rejected_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamp('rejected_at')->nullable();

            $table->text('rejection_reason')->nullable();
        });

        // Partial index: only approved incidents (used by query-side services)
        Schema::table('incidents', function (Blueprint $table): void {
            $table->index(['approved_at'], 'idx_incidents_decided')
                ->where('approved_at IS NOT NULL');
        });
    }

    public function down(): void
    {
        Schema::table('incidents', function (Blueprint $table): void {
            $table->dropIndex('idx_incidents_decided');

            $table->dropForeign(['approved_by']);
            $table->dropColumn('approved_by');
            $table->dropColumn('approved_at');

            $table->dropForeign(['rejected_by']);
            $table->dropColumn('rejected_by');
            $table->dropColumn('rejected_at');

            $table->dropColumn('rejection_reason');
        });
    }
};
