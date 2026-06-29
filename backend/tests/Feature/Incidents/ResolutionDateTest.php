<?php

declare(strict_types=1);

use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Locations\Models\Location;
use App\Domains\Roles\Models\Role;
use App\Domains\Users\Models\User;
use App\StatusHistory\Repositories\EloquentStatusHistoryRepository;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

// CP-02-05-B: Campo fecha_resolucion tiene timestamp válido, coincide con último cambio de estado

beforeEach(function (): void {
    Role::create(['id' => 1, 'name' => 'Admin']);

    $location = Location::create(['name' => 'Test Location', 'level' => 'city']);
    IncidentCategory::create(['name' => 'Test Category']);

    $this->user = User::factory()->create();

    $this->incident = Incident::create([
        'incident_category_id' => IncidentCategory::first()->id,
        'user_id'              => $this->user->id,
        'location_id'          => $location->id,
        'title'                => 'Incidencia CP-02-05-B',
        'status'               => Incident::STATUS_PENDING,
        'priority'             => Incident::PRIORITY_MEDIUM,
    ]);

    $this->repo = new EloquentStatusHistoryRepository;
});

it('CP-02-05-B: sets resolution_date when status transitions to resolved', function (): void {
    $this->actingAs($this->user);

    $before = now()->subSecond();

    $this->repo->cambiarEstado($this->incident, Incident::STATUS_IN_PROGRESS, $this->user->id, null);
    $this->repo->cambiarEstado($this->incident->fresh(), Incident::STATUS_RESOLVED, $this->user->id, null);

    $row = DB::table('incidents')->where('id', $this->incident->id)->first();

    expect($row->resolution_date)->not->toBeNull();

    $resolutionDate = \Carbon\Carbon::parse($row->resolution_date);
    expect($resolutionDate->greaterThanOrEqualTo($before))->toBeTrue();
    expect($resolutionDate->lessThanOrEqualTo(now()->addSecond()))->toBeTrue();
});

it('CP-02-05-B: resolution_date matches the created_at of the last status_history record', function (): void {
    $this->actingAs($this->user);

    $this->repo->cambiarEstado($this->incident, Incident::STATUS_IN_PROGRESS, $this->user->id, null);
    $this->repo->cambiarEstado($this->incident->fresh(), Incident::STATUS_RESOLVED, $this->user->id, null);

    $row = DB::table('incidents')->where('id', $this->incident->id)->first();
    $lastHistory = DB::table('status_history')
        ->where('incident_id', $this->incident->id)
        ->where('new_status', Incident::STATUS_RESOLVED)
        ->latest('created_at')
        ->first();

    expect($lastHistory)->not->toBeNull();

    $resolutionDate = \Carbon\Carbon::parse($row->resolution_date);
    $historyDate = \Carbon\Carbon::parse($lastHistory->created_at);

    // Both timestamps are set within the same DB transaction — must be within 1 second
    expect($resolutionDate->diffInSeconds($historyDate))->toBeLessThanOrEqual(1);
});

it('CP-02-05-B: clears resolution_date when reverting from resolved to in_progress', function (): void {
    $this->actingAs($this->user);

    $this->repo->cambiarEstado($this->incident, Incident::STATUS_IN_PROGRESS, $this->user->id, null);
    $this->repo->cambiarEstado($this->incident->fresh(), Incident::STATUS_RESOLVED, $this->user->id, null);
    $this->repo->cambiarEstado($this->incident->fresh(), Incident::STATUS_IN_PROGRESS, $this->user->id, null);

    $row = DB::table('incidents')->where('id', $this->incident->id)->first();

    expect($row->resolution_date)->toBeNull();
});
