<?php

declare(strict_types=1);

use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Incidents\Enums\ApprovalDecision;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Incidents\Services\IncidentApprovalService;
use App\Domains\Locations\Models\Location;
use App\Domains\Notifications\Enums\NotificationType;
use App\Domains\Notifications\Models\Notification;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Sessions\Http\Middleware\JwtAuthenticate;
use App\Domains\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Mockery\MockInterface;

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

// ─── sc-123: admin approval endpoints (WU3) ───────────────────────────────

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

// ─── 3.1 + 3.2 — controller delegates to IncidentApprovalService ───────────

it('approve delegates to IncidentApprovalService::decide() with Approved decision', function (): void {
    ['admin' => $admin, 'notification' => $notification] = makeAdminAndApprovalNotification();

    $this->mock(IncidentApprovalService::class, function (MockInterface $mock) use ($admin, $notification): void {
        $mock->shouldReceive('decide')
            ->once()
            ->with(
                $notification->incident_id,
                Mockery::on(fn ($u) => $u->id === $admin->id),
                ApprovalDecision::Approved,
                null,
            )
            ->andReturn($notification);
    });

    $this->actingAs($admin);
    $response = $this->postJson("/api/notifications/{$notification->id}/approve");

    $response->assertOk();
});

it('reject delegates to IncidentApprovalService::decide() with Rejected decision and reason', function (): void {
    ['admin' => $admin, 'notification' => $notification] = makeAdminAndApprovalNotification();

    $this->mock(IncidentApprovalService::class, function (MockInterface $mock) use ($admin, $notification): void {
        $mock->shouldReceive('decide')
            ->once()
            ->with(
                $notification->incident_id,
                Mockery::on(fn ($u) => $u->id === $admin->id),
                ApprovalDecision::Rejected,
                'Necesita más evidencia.',
            )
            ->andReturn($notification);
    });

    $this->actingAs($admin);
    $response = $this->postJson("/api/notifications/{$notification->id}/reject", [
        'reason' => 'Necesita más evidencia.',
    ]);

    $response->assertOk();
});

it('reject without reason returns 422 with errors.reason', function (): void {
    ['admin' => $admin, 'notification' => $notification] = makeAdminAndApprovalNotification();

    $this->actingAs($admin);
    $response = $this->postJson("/api/notifications/{$notification->id}/reject", []);

    $response->assertStatus(422);
    $response->assertJsonValidationErrors(['reason']);
});

it('index defaults per_page to 50 when no per_page query param is sent', function (): void {
    // Create 50 notifications for the reporter — enough to fill the
    // default page size and prove the controller is asking for 50, not 20.
    for ($i = 0; $i < 50; $i++) {
        Notification::create([
            'user_id' => $this->reporter->id,
            'incident_id' => $this->incident->id,
            'type' => NotificationType::Claim->value,
            'message' => "msg {$i}",
            'data' => [],
            'read' => false,
        ]);
    }

    $this->actingAs($this->reporter);
    $response = $this->getJson('/api/notifications');

    $response->assertOk();
    $response->assertJsonCount(50, 'data');
    expect($response->json('meta.per_page'))->toBe(50);
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
