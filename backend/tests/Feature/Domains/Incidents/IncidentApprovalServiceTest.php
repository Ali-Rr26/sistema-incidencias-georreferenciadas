<?php

declare(strict_types=1);

use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Incidents\Enums\ApprovalDecision;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Incidents\Models\IncidentApproval;
use App\Domains\Incidents\Services\IncidentApprovalService;
use App\Domains\Locations\Models\Location;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    DB::table('roles')->insert([
        ['id' => 1, 'name' => 'admin_sistema'],
        ['id' => 2, 'name' => 'admin_organizacion'],
    ]);

    $location = Location::create(['name' => 'Test City', 'level' => 'city']);

    $placeholderOrg = Organization::create([
        'name' => 'Placeholder Org',
        'location_id' => $location->id,
        'max_active_claims' => 5,
    ]);
    $this->category = IncidentCategory::create([
        'name' => 'Test Category',
        'organization_id' => $placeholderOrg->id,
    ]);

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

    $this->adminA = User::factory()->create([
        'role_id' => 2,
        'organization_id' => $this->orgA->id,
    ]);
    $this->adminB = User::factory()->create([
        'role_id' => 2,
        'organization_id' => $this->orgB->id,
    ]);
    $this->systemAdmin = User::factory()->create([
        'role_id' => 1,
        'organization_id' => $this->orgB->id,
    ]);

    $reporter = User::factory()->create();

    $makeIncident = fn (string $status): Incident => Incident::create([
        'incident_category_id' => $this->category->id,
        'user_id' => $reporter->id,
        'location_id' => $location->id,
        'title' => 'Incident in Org A',
        'status' => $status,
        'priority' => 'medium',
        'organization_id' => $this->orgA->id,
    ]);

    $this->resolved = $makeIncident('resolved');
    $this->pending = $makeIncident('pending');

    $this->service = app(IncidentApprovalService::class);
});

it('records an approval for a resolved incident', function (): void {
    $approval = $this->service->approve($this->resolved->id, $this->adminA);

    expect($approval->decision)->toBe(ApprovalDecision::Approved)
        ->and($approval->incident_id)->toBe($this->resolved->id)
        ->and($approval->decided_by)->toBe($this->adminA->id)
        ->and($approval->organization_id)->toBe($this->orgA->id)
        ->and($approval->rejection_reason)->toBeNull()
        ->and($approval->decided_at)->not->toBeNull();
});

it('records a rejection with its reason', function (): void {
    $approval = $this->service->reject($this->resolved->id, $this->adminA, 'La foto no muestra el arreglo.');

    expect($approval->decision)->toBe(ApprovalDecision::Rejected)
        ->and($approval->rejection_reason)->toBe('La foto no muestra el arreglo.');
});

it('allows rejecting without a reason', function (): void {
    $approval = $this->service->reject($this->resolved->id, $this->adminA);

    expect($approval->decision)->toBe(ApprovalDecision::Rejected)
        ->and($approval->rejection_reason)->toBeNull();
});

it('rejects a decision on an incident that is not resolved', function (): void {
    expect(fn () => $this->service->approve($this->pending->id, $this->adminA))
        ->toThrow(RuntimeException::class);

    try {
        $this->service->approve($this->pending->id, $this->adminA);
    } catch (RuntimeException $e) {
        expect($e->getCode())->toBe(409);
    }

    expect(IncidentApproval::count())->toBe(0);
});

it('rejects a second decision on an already decided incident', function (): void {
    $this->service->approve($this->resolved->id, $this->adminA);

    try {
        $this->service->reject($this->resolved->id, $this->adminA, 'me arrepentí');
        $this->fail('Expected a RuntimeException for the second decision.');
    } catch (RuntimeException $e) {
        expect($e->getCode())->toBe(409);
    }

    // The first decision stays untouched — decisions are immutable.
    expect(IncidentApproval::count())->toBe(1)
        ->and(IncidentApproval::first()->decision)->toBe(ApprovalDecision::Approved);
});

it('rejects a decision from an admin of another organization', function (): void {
    try {
        $this->service->approve($this->resolved->id, $this->adminB);
        $this->fail('Expected a RuntimeException for the cross-organization admin.');
    } catch (RuntimeException $e) {
        expect($e->getCode())->toBe(403);
    }

    expect(IncidentApproval::count())->toBe(0);
});

it('allows a system admin to decide across organizations', function (): void {
    $approval = $this->service->approve($this->resolved->id, $this->systemAdmin);

    expect($approval->decision)->toBe(ApprovalDecision::Approved)
        // The approval belongs to the incident's organization, not the actor's.
        ->and($approval->organization_id)->toBe($this->orgA->id);
});

it('fails when the incident does not exist', function (): void {
    try {
        $this->service->approve(999999, $this->adminA);
        $this->fail('Expected a RuntimeException for the missing incident.');
    } catch (RuntimeException $e) {
        expect($e->getCode())->toBe(404);
    }
});

it('exposes the decision through the incident relation', function (): void {
    $this->service->approve($this->resolved->id, $this->adminA);

    expect($this->resolved->fresh()->approval->decision)->toBe(ApprovalDecision::Approved);
});
