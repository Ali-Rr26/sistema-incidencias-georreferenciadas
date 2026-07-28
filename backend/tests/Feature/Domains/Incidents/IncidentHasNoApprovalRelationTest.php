<?php

declare(strict_types=1);

use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Locations\Models\Location;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Users\Models\User;
use Illuminate\Database\Eloquent\RelationNotFoundException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

/**
 * WU2 (PR-1b) — guard test for the `Incident::approval()` HasOne removal.
 *
 * After `git revert 86a4d45a` the `HasOne` relation + the `IncidentApproval`
 * model are gone (the table is dropped in the next task). Any eager-load or
 * property access that still tries `->approval` would throw a relation
 * error and surface as a 500 in the controller. This test verifies the
 * relation is gone from the public API.
 */
beforeEach(function (): void {
    DB::table('roles')->insert([
        ['id' => 5, 'name' => 'usuario'],
    ]);

    $location = Location::create(['name' => 'Test City', 'level' => 'city']);
    $org = Organization::create([
        'name' => 'Org',
        'location_id' => $location->id,
        'max_active_claims' => 5,
    ]);
    $category = IncidentCategory::create([
        'name' => 'Test Category',
        'organization_id' => $org->id,
    ]);
    $reporter = User::factory()->create();

    $this->incident = Incident::create([
        'incident_category_id' => $category->id,
        'user_id' => $reporter->id,
        'location_id' => $location->id,
        'title' => 'Test',
        'status' => 'resolved',
        'priority' => 'medium',
        'organization_id' => $org->id,
    ]);
});

it('does not expose an approval() relation method on the Incident model', function (): void {
    expect(method_exists($this->incident, 'approval'))->toBeFalse();
});

it('does not load approval via with() at the query level', function (): void {
    // Loading `approval` via the eager-load API would silently return an
    // empty relation if the underlying `IncidentApproval` model were also
    // gone, which is the "false negative" failure mode we're protecting
    // against. Laravel throws `RelationNotFoundException` when a relation
    // name doesn't resolve to anything on the model.
    expect(fn () => Incident::query()->with('approval')->find($this->incident->id))
        ->toThrow(RelationNotFoundException::class);
});
