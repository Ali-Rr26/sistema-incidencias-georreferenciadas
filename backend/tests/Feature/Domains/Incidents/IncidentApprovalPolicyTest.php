<?php

declare(strict_types=1);

use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Incidents\Http\Policies\IncidentPolicy;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Locations\Models\Location;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Users\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(PermissionSeeder::class);
    $this->seed(RoleSeeder::class);
    $this->seed(RolePermissionSeeder::class);

    $location = Location::create(['name' => 'Test City', 'level' => 'city']);

    $this->orgA = Organization::create([
        'name' => 'Org A',
        'location_id' => $location->id,
        'max_active_claims' => 5,
    ]);
    $this->orgB = Organization::create([
        'name' => 'Org B',
        'location_id' => $location->id,
        'max_active_claims' => 5,
    ]);

    $category = IncidentCategory::create([
        'name' => 'Test Category',
        'organization_id' => $this->orgA->id,
    ]);

    $reporter = User::factory()->create();

    $this->incident = Incident::create([
        'incident_category_id' => $category->id,
        'user_id' => $reporter->id,
        'location_id' => $location->id,
        'title' => 'Resolved incident in Org A',
        'status' => 'resolved',
        'priority' => 'medium',
        'organization_id' => $this->orgA->id,
    ]);

    $this->policy = new IncidentPolicy;

    // Role IDs come from RoleSeeder: 1 admin_sistema, 2 operador_sistema,
    // 3 admin_organizacion, 4 operador_organizacion, 5 usuario.
    $this->makeUser = fn (int $roleId, ?int $orgId) => User::factory()->create([
        'role_id' => $roleId,
        'organization_id' => $orgId,
    ]);
});

it('allows an organization admin of the same organization', function (): void {
    $admin = ($this->makeUser)(3, $this->orgA->id);

    expect($this->policy->approve($admin, $this->incident))->toBeTrue();
});

it('denies an organization admin of another organization', function (): void {
    $admin = ($this->makeUser)(3, $this->orgB->id);

    expect($this->policy->approve($admin, $this->incident))->toBeFalse();
});

it('allows a system admin regardless of organization', function (): void {
    $admin = ($this->makeUser)(1, $this->orgB->id);

    expect($this->policy->approve($admin, $this->incident))->toBeTrue();
});

it('denies the operator who resolves incidents', function (): void {
    // The whole point of incidents.approve being its own permission:
    // operador_organizacion holds incidents.update and is the one who
    // resolves the incident, so it must not be able to self-approve.
    $operator = ($this->makeUser)(4, $this->orgA->id);

    expect($this->policy->approve($operator, $this->incident))->toBeFalse();
});

it('denies a plain citizen', function (): void {
    $citizen = ($this->makeUser)(5, null);

    expect($this->policy->approve($citizen, $this->incident))->toBeFalse();
});
