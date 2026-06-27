<?php

declare(strict_types=1);

use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Incidents\Models\IncidentOrganizationAssignment;
use App\Domains\Incidents\Services\IncidentOrganizationAssignmentService;
use App\Domains\Locations\Models\Location;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Roles\Models\Role;
use App\Domains\Users\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    Role::create(['id' => 1, 'name' => 'Admin']);

    $location = Location::create(['name' => 'Test Location', 'level' => 'city']);
    $this->org = Organization::create(['name' => 'Test Org', 'location_id' => $location->id]);
    $category = IncidentCategory::create(['name' => 'Test Category']);
    $this->user = User::factory()->create();

    $this->incident = Incident::create([
        'incident_category_id' => $category->id,
        'user_id' => $this->user->id,
        'location_id' => $location->id,
        'title' => 'Test Incident',
        'status' => 'pending',
        'priority' => 'medium',
    ]);

    $this->service = new IncidentOrganizationAssignmentService;
});

it('first assignment succeeds and sets incident organization_id', function (): void {
    $assignment = $this->service->assign($this->incident, $this->org, $this->user);

    expect($assignment)->toBeInstanceOf(IncidentOrganizationAssignment::class);
    expect($assignment->status->value)->toBe('accepted');
    expect($assignment->incident_id)->toBe($this->incident->id);
    expect($assignment->organization_id)->toBe($this->org->id);

    $this->incident->refresh();
    expect($this->incident->organization_id)->toBe($this->org->id);
});

it('second accepted assignment for same incident is rejected on pgsql', function (): void {
    if (DB::getDriverName() !== 'pgsql') {
        $this->markTestSkipped('Partial unique index exclusivity enforcement requires PostgreSQL.');
    }

    $location2 = Location::create(['name' => 'Location 2', 'level' => 'city']);
    $org2 = Organization::create(['name' => 'Org 2', 'location_id' => $location2->id]);

    $this->service->assign($this->incident, $this->org, $this->user);

    expect(fn () => $this->service->assign($this->incident, $org2, $this->user))
        ->toThrow(QueryException::class);
});

it('unowned incident appears in unassigned incident query', function (): void {
    $location2 = Location::create(['name' => 'Location 2', 'level' => 'city']);
    $category2 = IncidentCategory::create(['name' => 'Category 2']);

    $assignedIncident = Incident::create([
        'incident_category_id' => $category2->id,
        'user_id' => $this->user->id,
        'location_id' => $location2->id,
        'title' => 'Assigned Incident',
        'status' => 'pending',
        'priority' => 'low',
    ]);

    $this->service->assign($assignedIncident, $this->org, $this->user);

    $unassigned = Incident::whereDoesntHave(
        'organizationAssignments',
        fn ($q) => $q->where('status', 'accepted')
    )->get();

    expect($unassigned->contains($this->incident))->toBeTrue();
    expect($unassigned->contains($assignedIncident))->toBeFalse();
});
