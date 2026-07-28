<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * WU2 (PR-1b) — add `processed_at` to `notifications`.
 *
 * Replaces the historical `data->decision` JSON flag as the canonical marker
 * for "this approval notification has been resolved by an admin". `null`
 * means still pending; a timestamp means an admin either approved or
 * rejected the source incident.
 *
 * Why a dedicated column instead of `data->decision`:
 *  - Cheap indexable predicate for filtering (no JSONB extraction in
 *    queries that need "decididas vs pendientes").
 *  - Plays nicely with the Postgres audit trail and Dashboard's "Pendientes
 *    de aprobación" stat card (`Incident::where('status','resolved')->count()`,
 *    WU7) which otherwise would have to JOIN through `notifications.data`.
 *  - The legacy `data->decision` field stays in the JSON column for
 *    backward compatibility with already-decided notifications — we don't
 *    backfill, the `data->decision` reads keep working via the
 *    `NotificationResource` shim until rows are purged naturally.
 *
 * `down()` is irreversible: dropping `processed_at` while there may be
 * already-decided notifications would make their state unrecoverable. We
 * follow the pattern of the sibling migration
 * `2026_07_27_000001_add_incident_approval_notification_type_check.php`
 * which also chose to leave the new column in place on rollback for the
 * same reason.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Idempotent guard: this migration is re-applied by sibling migration
        // tests (see `tests/Feature/Migrations/DropLegacyImageStorageTest`)
        // when they `rollbackThroughMigration(...)` past the column's
        // creation and then re-`migrate`. Without the `hasColumn` check the
        // re-run trips `42701: column "processed_at" already exists` on
        // PostgreSQL because the rollback only flips the migration tracking
        // row, not the underlying DDL.
        if (! Schema::hasColumn('notifications', 'processed_at')) {
            Schema::table('notifications', function (Blueprint $table): void {
                // Nullable so existing rows (most of them) keep `processed_at = NULL`
                // — semantically "not yet decided", which is correct for every
                // non-approval notification type.
                $table->timestamp('processed_at')->nullable()->after('read');

                // Partial index would be ideal in PostgreSQL but Laravel's
                // Blueprint doesn't expose it portably; on pgsql we add it via
                // raw SQL. Cheaper than scanning the whole table once the
                // notification list grows.
                $table->index('processed_at', 'notifications_processed_at_index');
            });
        }
    }

    public function down(): void
    {
        // Intentionally irreversible (see docblock). The matching test
        // (DropLegacyImageStorageTest) only rolls back migrations that came
        // before this one and never asks for a real `down()` here; if a
        // future rollback does, it must drop the column AND the index in a
        // single statement.
    }
};
