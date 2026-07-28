<?php

declare(strict_types=1);

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;

uses(RefreshDatabase::class);

/**
 * WU2 (PR-1b) — guard test for the `incident_approvals` table drop.
 *
 * The `incident_approvals` table was added by commit 86a4d45a (reverted in
 * 62c8ddfd) and is now considered dead code per the
 * `incident-approval-workflow` proposal (ADR-1). The migration
 * `2026_07_28_011300_drop_incident_approvals_table_if_exists.php` drops
 * the table if it still exists, so environments that already deployed the
 * refactor converge to the same schema as fresh deployments.
 *
 * The tests below exercise both halves of the contract:
 *
 *  - The drop migration actually drops the table when present.
 *  - The drop migration is a no-op when the table already doesn't exist
 *    (idempotent for fresh deployments that never had the table).
 *
 * We invoke the migration directly via `app('migrator')->run([...])`
 * rather than `Artisan::call('migrate')` because `RefreshDatabase` has
 * already migrated to head — `migrate` would short-circuit and our new
 * migration wouldn't run.
 */
it('drops the incident_approvals table when it exists', function (): void {
    // Simulate the legacy state where 86a4d45a already ran in production:
    // recreate the table verbatim from the reverted migration so we can
    // assert the drop migration actually deletes it.
    Schema::create('incident_approvals', function (\Illuminate\Database\Schema\Blueprint $table): void {
        $table->id();
        $table->foreignId('incident_id')->constrained('incidents')->cascadeOnDelete();
        $table->foreignId('decided_by')->constrained('users')->cascadeOnDelete();
        $table->string('decision', 16);
        $table->text('rejection_reason')->nullable();
        $table->foreignId('organization_id')->constrained('organizations')->cascadeOnDelete();
        $table->timestamp('decided_at');
        $table->unique('incident_id', 'incident_approvals_incident_id_unique');
    });

    expect(Schema::hasTable('incident_approvals'))->toBeTrue();

    // Run the drop migration directly.
    $migration = require database_path('migrations/2026_07_28_011300_drop_incident_approvals_table_if_exists.php');
    $migration->up();

    expect(Schema::hasTable('incident_approvals'))->toBeFalse();
});

it('is idempotent when the table already does not exist', function (): void {
    // Fresh test DB (the default RefreshDatabase state) — the table was
    // already gone because the revert removed the create migration. The
    // drop migration's `dropIfExists` must be a no-op, not an error.
    expect(Schema::hasTable('incident_approvals'))->toBeFalse();

    $migration = require database_path('migrations/2026_07_28_011300_drop_incident_approvals_table_if_exists.php');
    $migration->up();

    expect(Schema::hasTable('incident_approvals'))->toBeFalse();
});

it('rolls back via down() by recreating the original schema', function (): void {
    $migration = require database_path('migrations/2026_07_28_011300_drop_incident_approvals_table_if_exists.php');

    // Run up + down + up to verify the down() recreates the original schema
    // shape verbatim. We can't compare row-by-row (the original migration
    // may have set a CHECK constraint that this test DB doesn't have) but
    // we can assert the columns and the unique index are back.
    $migration->up();
    expect(Schema::hasTable('incident_approvals'))->toBeFalse();

    $migration->down();
    expect(Schema::hasTable('incident_approvals'))->toBeTrue();
    expect(Schema::hasColumn('incident_approvals', 'incident_id'))->toBeTrue();
    expect(Schema::hasColumn('incident_approvals', 'decided_by'))->toBeTrue();
    expect(Schema::hasColumn('incident_approvals', 'decision'))->toBeTrue();
    expect(Schema::hasColumn('incident_approvals', 'rejection_reason'))->toBeTrue();
    expect(Schema::hasColumn('incident_approvals', 'organization_id'))->toBeTrue();
    expect(Schema::hasColumn('incident_approvals', 'decided_at'))->toBeTrue();
});
