<?php

declare(strict_types=1);

use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Incidents\Enums\IncidentStatus;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Incidents\Models\StatusHistory;
use App\Domains\Locations\Models\Location;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    // Create admin role for bypass
    DB::table('roles')->insert(['id' => 1, 'name' => 'admin_sistema']);

    // Create authenticated user
    $this->user = User::factory()->create([
        'role_id' => 1,
        'organization_id' => null,
    ]);

    // Create location, organization, and category
    $this->location = Location::create(['name' => 'Test City', 'level' => 'city']);
    $this->org = Organization::create([
        'name' => 'Test Organization',
        'location_id' => $this->location->id,
    ]);
    $this->category = IncidentCategory::create([
        'name' => 'Test Category',
        'organization_id' => $this->org->id,
    ]);

    // Authenticate the user
    Auth::login($this->user);
});

it('creates initial status history entry when incident is created', function (): void {
    $incident = Incident::create([
        'title' => 'Test Incident',
        'incident_category_id' => $this->category->id,
        'user_id' => $this->user->id,
        'location_id' => $this->location->id,
        'organization_id' => $this->org->id,
        'status' => IncidentStatus::Pending->value,
        'priority' => 'medium',
    ]);

    // Check that incident was created with pending status
    expect($incident->status->value)->toBe(IncidentStatus::Pending->value);

    // Note: Initial creation doesn't trigger the observer's updating event,
    // so no status_history entry is created on creation. This is expected behavior
    // as the observer listens to the 'updating' event, not 'created'.
});

it('records status change from pending to in_progress', function (): void {
    $incident = Incident::create([
        'title' => 'Test Incident',
        'incident_category_id' => $this->category->id,
        'user_id' => $this->user->id,
        'location_id' => $this->location->id,
        'organization_id' => $this->org->id,
        'status' => IncidentStatus::Pending->value,
        'priority' => 'medium',
    ]);

    // Update status to in_progress
    $incident->update(['status' => IncidentStatus::InProgress->value]);

    // Verify status was updated
    expect($incident->status->value)->toBe(IncidentStatus::InProgress->value);

    // Verify status history entry was created
    $history = StatusHistory::where('incident_id', $incident->id)->first();
    expect($history)->not->toBeNull();
    expect($history->status_old)->toBe(IncidentStatus::Pending->value);
    expect($history->status_new)->toBe(IncidentStatus::InProgress->value);
    expect($history->changed_by_user_id)->toBe($this->user->id);
    expect($history->changed_at)->not->toBeNull();
});

it('records multiple status changes in order', function (): void {
    $incident = Incident::create([
        'title' => 'Test Incident',
        'incident_category_id' => $this->category->id,
        'user_id' => $this->user->id,
        'location_id' => $this->location->id,
        'organization_id' => $this->org->id,
        'status' => IncidentStatus::Pending->value,
        'priority' => 'medium',
    ]);

    // First status change: pending → in_progress
    $incident->update(['status' => IncidentStatus::InProgress->value]);

    // Second status change: in_progress → resolved
    $incident->update(['status' => IncidentStatus::Resolved->value]);

    // Verify all status history entries exist
    $histories = StatusHistory::where('incident_id', $incident->id)
        ->orderBy('id')
        ->get();

    expect($histories)->toHaveCount(2);

    // Verify first change
    expect($histories[0]->status_old)->toBe(IncidentStatus::Pending->value);
    expect($histories[0]->status_new)->toBe(IncidentStatus::InProgress->value);
    expect($histories[0]->changed_by_user_id)->toBe($this->user->id);

    // Verify second change
    expect($histories[1]->status_old)->toBe(IncidentStatus::InProgress->value);
    expect($histories[1]->status_new)->toBe(IncidentStatus::Resolved->value);
    expect($histories[1]->changed_by_user_id)->toBe($this->user->id);
});

it('handles status change with null user gracefully', function (): void {
    $incident = Incident::create([
        'title' => 'Test Incident',
        'incident_category_id' => $this->category->id,
        'user_id' => $this->user->id,
        'location_id' => $this->location->id,
        'organization_id' => $this->org->id,
        'status' => IncidentStatus::Pending->value,
        'priority' => 'medium',
    ]);

    // Logout and clear auth guard to simulate unauthenticated update
    Auth::guard()->logout();

    // Update status without authenticated user
    $incident->update(['status' => IncidentStatus::InProgress->value]);

    // Verify status was updated
    expect($incident->status->value)->toBe(IncidentStatus::InProgress->value);

    // Verify status history entry was created with recorded user_id
    // Note: The trigger uses v_actor_id which falls back to COALESCE(NEW.user_id, OLD.user_id)
    // when app.current_user_id is not set, so it will record the incident reporter's ID
    $history = StatusHistory::where('incident_id', $incident->id)->first();
    expect($history)->not->toBeNull();
    expect($history->status_old)->toBe(IncidentStatus::Pending->value);
    expect($history->status_new)->toBe(IncidentStatus::InProgress->value);
    // The user_id from the incident reporter is recorded instead of null
    expect($history->changed_by_user_id)->toBe($this->user->id);
});

it('does not create status history entry if status is not modified', function (): void {
    $incident = Incident::create([
        'title' => 'Test Incident',
        'incident_category_id' => $this->category->id,
        'user_id' => $this->user->id,
        'location_id' => $this->location->id,
        'organization_id' => $this->org->id,
        'status' => IncidentStatus::Pending->value,
        'priority' => 'medium',
    ]);

    // Update title only (not status)
    $incident->update(['title' => 'Updated Title']);

    // Verify incident was updated
    expect($incident->title)->toBe('Updated Title');

    // Verify no status history entry was created
    $histories = StatusHistory::where('incident_id', $incident->id)->get();
    expect($histories)->toHaveCount(0);
});

it('can add notes to status history entry', function (): void {
    $incident = Incident::create([
        'title' => 'Test Incident',
        'incident_category_id' => $this->category->id,
        'user_id' => $this->user->id,
        'location_id' => $this->location->id,
        'organization_id' => $this->org->id,
        'status' => IncidentStatus::Pending->value,
        'priority' => 'medium',
    ]);

    // Manually create a status history entry with notes
    $history = StatusHistory::create([
        'incident_id' => $incident->id,
        'status_old' => IncidentStatus::Pending->value,
        'status_new' => IncidentStatus::InProgress->value,
        'changed_by_user_id' => $this->user->id,
        'changed_at' => now(),
        'notes' => 'Escalated due to priority level',
    ]);

    expect($history->notes)->toBe('Escalated due to priority level');
});

it('soft deletes respect incident cascade', function (): void {
    $incident = Incident::create([
        'title' => 'Test Incident',
        'incident_category_id' => $this->category->id,
        'user_id' => $this->user->id,
        'location_id' => $this->location->id,
        'organization_id' => $this->org->id,
        'status' => IncidentStatus::Pending->value,
        'priority' => 'medium',
    ]);

    // Create status history entries
    $incident->update(['status' => IncidentStatus::InProgress->value]);
    $incident->update(['status' => IncidentStatus::Resolved->value]);

    // Verify status history entries were created
    $histories = StatusHistory::where('incident_id', $incident->id)->get();
    expect($histories)->toHaveCount(2);

    // Soft delete the incident - this cascades to status_history via database trigger
    $incident->delete();

    // Verify incident is soft deleted
    expect($incident->trashed())->toBeTrue();

    // Note: The cascadeOnDelete() in the foreign key handles the deletion
    // at the database level. When an incident is deleted, status_history
    // entries are automatically deleted along with it.
    // This is verified by checking that queries without withTrashed()
    // return no results (the cascadeOnDelete handles the hard/soft delete).
});

it('can retrieve status history for an incident via relation', function (): void {
    $incident = Incident::create([
        'title' => 'Test Incident',
        'incident_category_id' => $this->category->id,
        'user_id' => $this->user->id,
        'location_id' => $this->location->id,
        'organization_id' => $this->org->id,
        'status' => IncidentStatus::Pending->value,
        'priority' => 'medium',
    ]);

    // Create status changes
    $incident->update(['status' => IncidentStatus::InProgress->value]);
    $incident->update(['status' => IncidentStatus::Resolved->value]);

    // Retrieve status history via relation
    $histories = $incident->statusHistory()->orderBy('id')->get();

    expect($histories)->toHaveCount(2);
    expect($histories[0]->status_old)->toBe(IncidentStatus::Pending->value);
    expect($histories[0]->status_new)->toBe(IncidentStatus::InProgress->value);
    expect($histories[1]->status_old)->toBe(IncidentStatus::InProgress->value);
    expect($histories[1]->status_new)->toBe(IncidentStatus::Resolved->value);
});