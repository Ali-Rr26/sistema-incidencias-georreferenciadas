<?php

declare(strict_types=1);

use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Incidents\Enums\IncidentStatus;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Locations\Models\Location;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Users\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

/**
 * The `incidents.status` column is constrained at the database level by a
 * CHECK constraint named `incidents_status_check` (see migrations
 * `2026_06_15_000005_create_incidents_table.php` and
 * `2026_07_08_000002_remove_publicador_role_and_verifications.php`).
 *
 * WU1 introduces a new terminal `closed` status reachable only via admin
 * approval (see proposal §"Backend" point 1 and design ADR-3). The CHECK
 * constraint MUST be widened to include `'closed'` so the approval flow
 * can persist `status='closed'`.
 *
 * If this test fails on a fresh database the WU1 migration was either
 * not authored, not applied, or did not include the new value.
 */
uses(RefreshDatabase::class);

beforeEach(function (): void {
    DB::table('roles')->insert([
        ['id' => 1, 'name' => 'admin_sistema'],
    ]);
    $user = User::factory()->create(['role_id' => 1]);
    $location = Location::create(['name' => 'HQ', 'level' => 'city']);
    $org = Organization::create([
        'name' => 'Test Org',
        'location_id' => $location->id,
    ]);
    $category = IncidentCategory::create([
        'name' => 'General',
        'organization_id' => $org->id,
    ]);

    $this->user = $user;
    $this->location = $location;
    $this->organization = $org;
    $this->category = $category;
});

it('allows closed as a valid status value at the DB CHECK constraint', function (): void {
    // 1) Sanity: every CHECK constraint on incidents.status lists `closed`
    //    among the allowed values. There are two named constraints today
    //    (see the WU1 migration docblock for context): both must agree.
    if (DB::connection()->getDriverName() === 'pgsql') {
        $rows = DB::select(
            "SELECT conname, pg_get_constraintdef(oid) AS def
               FROM pg_constraint
              WHERE conrelid = 'incidents'::regclass
                AND contype = 'c'
                AND conname IN ('incidents_status_check', 'chk_incident_status')",
        );
        expect($rows)->not->toBeEmpty('at least one status CHECK constraint must exist');

        foreach ($rows as $row) {
            expect($row->def)
                ->toContain("'closed'")
                ->toContain("'pending'")
                ->toContain("'in_progress'")
                ->toContain("'resolved'");
        }
    }

    // 2) Behavioural: a freshly-created incident with status='closed' must
    //    NOT be rejected by the constraint. Use the full Incident model
    //    create path (FK + NOT NULL satisfied by the beforeEach fixture).
    expect(fn () => Incident::create([
        'title' => 'Closed via DB CHECK',
        'incident_category_id' => $this->category->id,
        'user_id' => $this->user->id,
        'location_id' => $this->location->id,
        'organization_id' => $this->organization->id,
        'status' => IncidentStatus::Closed->value,
        'priority' => 'medium',
    ]))->not->toThrow(QueryException::class);
});

it('still rejects unknown status values not in the allowed list', function (): void {
    // Bypass the Eloquent enum cast (which would throw a ValueError for an
    // invalid status value) and hit the DB CHECK constraint directly with
    // a raw insert. The bogus value must be rejected by Postgres at the
    // CHECK layer, proving the constraint is still active after the WU1
    // widening.
    expect(fn () => DB::table('incidents')->insert([
        'title' => 'Bogus status',
        'incident_category_id' => $this->category->id,
        'user_id' => $this->user->id,
        'location_id' => $this->location->id,
        'organization_id' => $this->organization->id,
        'status' => 'not_a_real_status',
        'priority' => 'medium',
        'created_at' => now(),
        'updated_at' => now(),
    ]))->toThrow(QueryException::class);
});
