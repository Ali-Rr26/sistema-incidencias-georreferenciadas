<?php

declare(strict_types=1);

use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Locations\Models\Location;
use App\Domains\Notifications\Enums\NotificationType;
use App\Domains\Notifications\Models\Notification;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Sessions\Http\Middleware\JwtAuthenticate;
use App\Domains\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->withoutMiddleware(JwtAuthenticate::class);

    // Create roles used by the factory and by the test scenarios.
    // We use `operador_organizacion` for reporters (NOT admin) so that
    // Gate::before(...) bypass does not hide policy denials in the tests.
    //
    // Note: Role's $fillable does not include `id`, so we insert via the
    // query builder to keep the explicit ID.
    DB::table('roles')->insert([
        ['id' => 1, 'name' => 'admin_sistema', 'created_at' => now(), 'updated_at' => now()],
        ['id' => 4, 'name' => 'operador_organizacion', 'created_at' => now(), 'updated_at' => now()],
    ]);

    $this->location = Location::create(['name' => 'Test City', 'level' => 'city']);
    $placeholderOrg = Organization::create([
        'name' => 'Placeholder',
        'location_id' => $this->location->id,
        'max_active_claims' => 5,
    ]);
    $this->category = IncidentCategory::create(['name' => 'General', 'organization_id' => $placeholderOrg->id]);

    $this->reporter = User::factory()->create(['role_id' => 4]);
    $this->incident = Incident::create([
        'incident_category_id' => $this->category->id,
        'user_id' => $this->reporter->id,
        'location_id' => $this->location->id,
        'title' => 'Test incident',
        'description' => 'Test description',
        'status' => 'pending',
        'priority' => 'medium',
    ]);
});

it('returns empty list when user has no notifications', function (): void {
    $this->actingAs($this->reporter);

    $response = $this->getJson('/api/notifications');

    $response->assertOk();
    $response->assertJsonPath('data', []);
    $response->assertJsonPath('unread_count', 0);
});

it('returns only the authenticated user notifications', function (): void {
    $otherUser = User::factory()->create(['role_id' => 4]);

    Notification::create([
        'user_id' => $this->reporter->id,
        'incident_id' => $this->incident->id,
        'type' => NotificationType::Claim->value,
        'message' => 'Tu incidencia fue reclamada.',
        'data' => ['claimed_by' => 99],
        'read' => false,
    ]);
    Notification::create([
        'user_id' => $otherUser->id,
        'incident_id' => $this->incident->id,
        'type' => NotificationType::Claim->value,
        'message' => 'Otra.',
        'data' => [],
        'read' => false,
    ]);

    $this->actingAs($this->reporter);
    $response = $this->getJson('/api/notifications');

    $response->assertOk();
    $response->assertJsonCount(1, 'data');
    $response->assertJsonPath('data.0.type', 'claim');
});

it('filters unread only when requested', function (): void {
    Notification::create([
        'user_id' => $this->reporter->id,
        'incident_id' => $this->incident->id,
        'type' => NotificationType::Claim->value,
        'message' => 'A',
        'data' => [],
        'read' => false,
    ]);
    Notification::create([
        'user_id' => $this->reporter->id,
        'incident_id' => $this->incident->id,
        'type' => NotificationType::Claim->value,
        'message' => 'B',
        'data' => [],
        'read' => true,
    ]);

    $this->actingAs($this->reporter);
    $response = $this->getJson('/api/notifications?unread_only=1');

    $response->assertOk();
    $response->assertJsonCount(1, 'data');
});

it('user cannot mark as read a notification owned by another user', function (): void {
    $otherUser = User::factory()->create(['role_id' => 4]);
    $notification = Notification::create([
        'user_id' => $otherUser->id,
        'incident_id' => $this->incident->id,
        'type' => NotificationType::Claim->value,
        'message' => 'other',
        'data' => [],
        'read' => false,
    ]);

    $this->actingAs($this->reporter);
    $response = $this->patchJson("/api/notifications/{$notification->id}/read");

    $response->assertForbidden();
    expect($notification->fresh()->read)->toBeFalse();
});

it('user can mark their own notification as read', function (): void {
    $notification = Notification::create([
        'user_id' => $this->reporter->id,
        'incident_id' => $this->incident->id,
        'type' => NotificationType::Claim->value,
        'message' => 'mine',
        'data' => [],
        'read' => false,
    ]);

    $this->actingAs($this->reporter);
    $response = $this->patchJson("/api/notifications/{$notification->id}/read");

    $response->assertOk();
    expect($notification->fresh()->read)->toBeTrue();
});

it('mark all read updates all user notifications', function (): void {
    Notification::create([
        'user_id' => $this->reporter->id,
        'incident_id' => $this->incident->id,
        'type' => NotificationType::Claim->value,
        'message' => '1',
        'data' => [],
        'read' => false,
    ]);
    Notification::create([
        'user_id' => $this->reporter->id,
        'incident_id' => $this->incident->id,
        'type' => NotificationType::Claim->value,
        'message' => '2',
        'data' => [],
        'read' => false,
    ]);

    $this->actingAs($this->reporter);
    $response = $this->patchJson('/api/notifications/read-all');

    $response->assertOk();
    $response->assertJsonPath('updated', 2);
    $response->assertJsonPath('unread_count', 0);
});

it('unread count endpoint returns correct count', function (): void {
    Notification::create([
        'user_id' => $this->reporter->id,
        'incident_id' => $this->incident->id,
        'type' => NotificationType::Claim->value,
        'message' => 'A',
        'data' => [],
        'read' => false,
    ]);
    Notification::create([
        'user_id' => $this->reporter->id,
        'incident_id' => $this->incident->id,
        'type' => NotificationType::Claim->value,
        'message' => 'B',
        'data' => [],
        'read' => true,
    ]);

    $this->actingAs($this->reporter);
    $response = $this->getJson('/api/notifications/unread-count');

    $response->assertOk();
    $response->assertJsonPath('unread_count', 1);
});

// ─── sc-123: admin approval endpoints ─────────────────────────────────

function makeAdminAndApprovalNotification(): array
{
    test()->admin = User::factory()->create(['role_id' => 1]); // admin_sistema
    DB::table('roles')->where('id', 1)->update(['name' => 'admin_sistema']);
    test()->approvalNotification = Notification::create([
        'user_id' => test()->admin->id,
        'incident_id' => test()->incident->id,
        'type' => NotificationType::IncidenciaAtendidaParaAprobacion->value,
        'message' => 'Una incidencia atendida requiere tu aprobación.',
        'data' => [
            'incident_id' => test()->incident->id,
            'actor_user_id' => test()->reporter->id,
            'decision' => null,
            'rejection_reason' => null,
            'expires_at' => now()->addDays(7)->toIso8601String(),
            'organization_id' => test()->incident->organization_id,
        ],
        'read' => false,
    ]);

    return ['admin' => test()->admin, 'notification' => test()->approvalNotification];
}

it('admin can approve a pending approval notification', function (): void {
    ['admin' => $admin, 'notification' => $notification] = makeAdminAndApprovalNotification();

    $this->actingAs($admin);
    $response = $this->postJson("/api/notifications/{$notification->id}/approve");

    $response->assertOk();
    $notification->refresh();
    expect($notification->data['decision'])->toBe('approved');
    expect($notification->data['rejection_reason'])->toBeNull();
    expect($notification->read)->toBeTrue();
});

it('admin can reject without a reason (reason is nullable)', function (): void {
    ['admin' => $admin, 'notification' => $notification] = makeAdminAndApprovalNotification();

    $this->actingAs($admin);
    $response = $this->postJson("/api/notifications/{$notification->id}/reject", []);

    $response->assertOk();
    $notification->refresh();
    expect($notification->data['decision'])->toBe('rejected');
    expect($notification->data['rejection_reason'])->toBeNull();
});

it('admin can reject with a reason', function (): void {
    ['admin' => $admin, 'notification' => $notification] = makeAdminAndApprovalNotification();

    $this->actingAs($admin);
    $response = $this->postJson("/api/notifications/{$notification->id}/reject", [
        'reason' => 'Necesita más evidencia.',
    ]);

    $response->assertOk();
    $notification->refresh();
    expect($notification->data['decision'])->toBe('rejected');
    expect($notification->data['rejection_reason'])->toBe('Necesita más evidencia.');
});

it('rejects a reason longer than 1000 chars', function (): void {
    ['admin' => $admin, 'notification' => $notification] = makeAdminAndApprovalNotification();

    $this->actingAs($admin);
    $response = $this->postJson("/api/notifications/{$notification->id}/reject", [
        'reason' => str_repeat('a', 1001),
    ]);

    $response->assertStatus(422);
});

it('non-admin cannot approve an approval notification', function (): void {
    ['notification' => $notification] = makeAdminAndApprovalNotification();
    // reporter is role 4 (operador_organizacion), no notifications.update
    $this->actingAs($this->reporter);

    $response = $this->postJson("/api/notifications/{$notification->id}/approve");

    $response->assertStatus(403);
});

it('admin cannot approve a non-approval notification type', function (): void {
    $admin = User::factory()->create(['role_id' => 1]);
    DB::table('roles')->where('id', 1)->update(['name' => 'admin_sistema']);
    $commentNotification = Notification::create([
        'user_id' => $admin->id,
        'incident_id' => $this->incident->id,
        'type' => NotificationType::Comment->value,
        'message' => 'un comentario',
        'data' => [],
        'read' => false,
    ]);

    $this->actingAs($admin);
    $response = $this->postJson("/api/notifications/{$commentNotification->id}/approve");

    $response->assertStatus(403);
});

it('admin cannot decide an already-decided notification', function (): void {
    ['admin' => $admin, 'notification' => $notification] = makeAdminAndApprovalNotification();

    $this->actingAs($admin);
    // First approve succeeds.
    $this->postJson("/api/notifications/{$notification->id}/approve")->assertOk();

    // Second attempt (re-decide) returns 409.
    $response = $this->postJson("/api/notifications/{$notification->id}/reject", [
        'reason' => 'too late',
    ]);
    $response->assertStatus(409);
});

it('admin cannot decide an expired approval notification', function (): void {
    ['admin' => $admin, 'notification' => $notification] = makeAdminAndApprovalNotification();
    // Backdate the expiration.
    $notification->update([
        'data' => array_merge($notification->data ?? [], [
            'expires_at' => now()->subDay()->toIso8601String(),
        ]),
    ]);

    $this->actingAs($admin);
    $response = $this->postJson("/api/notifications/{$notification->id}/approve");

    $response->assertStatus(409);
});

it('notification resource exposes approval metadata and not read_at', function (): void {
    ['admin' => $admin, 'notification' => $notification] = makeAdminAndApprovalNotification();

    $this->actingAs($admin);
    $response = $this->getJson('/api/notifications');

    $response->assertOk();
    $response->assertJsonPath('data.0.type', NotificationType::IncidenciaAtendidaParaAprobacion->value);
    $response->assertJsonPath('data.0.data.decision', null);
    $response->assertJsonPath('data.0.read', false);
    // read_at is intentionally absent — see NotificationResource.
    $response->assertJsonMissingPath('data.0.read_at');
});

it('index allows per_page up to 200', function (): void {
    $this->actingAs($this->reporter);
    $response = $this->getJson('/api/notifications?per_page=200');
    $response->assertOk();
    expect($response->json('meta.per_page'))->toBe(200);
});

it('index caps per_page above 200', function (): void {
    $this->actingAs($this->reporter);
    $response = $this->getJson('/api/notifications?per_page=500');
    $response->assertOk();
    expect($response->json('meta.per_page'))->toBe(200);
});
