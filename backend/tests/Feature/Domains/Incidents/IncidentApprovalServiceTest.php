<?php

declare(strict_types=1);

use App\Domains\Comments\Models\Comment;
use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Incidents\Enums\ApprovalDecision;
use App\Domains\Incidents\Enums\IncidentStatus;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Incidents\Services\IncidentApprovalService;
use App\Domains\Locations\Models\Location;
use App\Domains\Notifications\Enums\NotificationType;
use App\Domains\Notifications\Models\Notification;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Users\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

/**
 * WU2 (PR-1b) — IncidentApprovalService rewrite.
 *
 * Side-effect contract:
 *  - approve: incident.status -> closed; claimed_by/released_from null; citizen
 *    notified via NotificationService::notify(..., StatusChange, ...); source
 *    notification processed_at = now().
 *  - reject: incident.status -> in_progress; claimed_by preserved; operator
 *    notified with reason; source notification processed_at = now().
 *  - In both cases, status_history.user_id == $admin->id (not the citizen).
 *
 * The mutating path always goes through EloquentIncidentRepository::update()
 * so the audit actor binding (set_config('app.current_user_id', admin->id))
 * fires before the UPDATE, which is what makes the trigger record the admin
 * as the actor. Tests rely on $this->actingAs($admin) so Auth::id() resolves
 * to the admin and bindAuditActor() picks it up correctly.
 */
beforeEach(function (): void {
    DB::table('roles')->insert([
        ['id' => 1, 'name' => 'admin_sistema'],
        ['id' => 2, 'name' => 'operador_sistema'],
        ['id' => 3, 'name' => 'admin_organizacion'],
        ['id' => 4, 'name' => 'operador_organizacion'],
        ['id' => 5, 'name' => 'usuario'],
    ]);

    $location = Location::create(['name' => 'Test City', 'level' => 'city']);

    $this->placeholderOrg = Organization::create([
        'name' => 'Placeholder Org',
        'location_id' => $location->id,
        'max_active_claims' => 5,
    ]);

    $this->category = IncidentCategory::create([
        'name' => 'Test Category',
        'organization_id' => $this->placeholderOrg->id,
    ]);

    $this->orgA = Organization::create([
        'name' => 'Org A',
        'location_id' => $location->id,
        'max_active_claims' => 5,
    ]);

    $this->adminOrg = User::factory()->create([
        'role_id' => 3,
        'organization_id' => $this->orgA->id,
    ]);
    $this->operatorOrg = User::factory()->create([
        'role_id' => 4,
        'organization_id' => $this->orgA->id,
    ]);
    $this->systemAdmin = User::factory()->create([
        'role_id' => 1,
        'organization_id' => $this->placeholderOrg->id,
    ]);

    $this->citizen = User::factory()->create([
        'role_id' => 5,
        'organization_id' => null,
    ]);

    $this->resolved = Incident::create([
        'incident_category_id' => $this->category->id,
        'user_id' => $this->citizen->id,
        'location_id' => $location->id,
        'title' => 'Bache en calle X',
        'status' => IncidentStatus::Resolved->value,
        'priority' => 'medium',
        'organization_id' => $this->orgA->id,
        'claimed_by' => $this->operatorOrg->id,
        'claimed_at' => now()->subHour(),
    ]);

    // Source approval notification — admin receives, decides on this row.
    $this->sourceNotification = Notification::create([
        'user_id' => $this->adminOrg->id,
        'incident_id' => $this->resolved->id,
        'type' => NotificationType::IncidenciaAtendidaParaAprobacion->value,
        'message' => 'Una incidencia atendida requiere tu aprobación.',
        'data' => [
            'incident_id' => $this->resolved->id,
            'actor_user_id' => $this->operatorOrg->id,
            'expires_at' => now()->addDays(7)->toIso8601String(),
            'organization_id' => $this->orgA->id,
        ],
        'read' => false,
    ]);

    $this->service = app(IncidentApprovalService::class);
});

// ─── Happy paths ──────────────────────────────────────────────────────────────

it('approves a resolved incident end-to-end (S1)', function (): void {
    $this->actingAs($this->adminOrg);

    $result = $this->service->decide(
        $this->resolved->id,
        $this->adminOrg,
        ApprovalDecision::Approved,
        null,
    );

    // Return value: the updated source notification.
    expect($result)->toBeInstanceOf(Notification::class)
        ->and($result->id)->toBe($this->sourceNotification->id)
        ->and($result->processed_at)->not->toBeNull();

    // Incident mutated to closed, claim cleared.
    $incident = $this->resolved->fresh();
    expect($incident->status)->toBe(IncidentStatus::Closed)
        ->and($incident->claimed_by)->toBeNull();
    // `resolution_date` is set by the booted hook ONLY when transitioning
    // *into* `resolved` (see IncidentResolutionDateTest). The approve path
    // transitions *out* of `resolved` to `closed`, so we don't re-stamp
    // the resolution date here — the original `resolved` transition is
    // still the canonical resolution timestamp for analytics.
});

it('rejects a resolved incident and returns it to in_progress (S4)', function (): void {
    $this->actingAs($this->adminOrg);

    $reason = 'La foto no muestra el arreglo.';
    $result = $this->service->decide(
        $this->resolved->id,
        $this->adminOrg,
        ApprovalDecision::Rejected,
        $reason,
    );

    $incident = $this->resolved->fresh();
    expect($incident->status)->toBe(IncidentStatus::InProgress)
        // Operator claim is preserved — the rejection is a "review again",
        // not a desassignment.
        ->and($incident->claimed_by)->toBe($this->operatorOrg->id);

    expect($result->processed_at)->not->toBeNull();
});

// ─── Reason required on reject (service-level guard) ─────────────────────────

it('throws on reject without a reason', function (): void {
    $this->actingAs($this->adminOrg);

    try {
        $this->service->decide(
            $this->resolved->id,
            $this->adminOrg,
            ApprovalDecision::Rejected,
            null,
        );
        $this->fail('Expected RuntimeException for reject without reason.');
    } catch (RuntimeException $e) {
        expect($e->getCode())->toBe(422);
    }

    // Incident untouched.
    expect($this->resolved->fresh()->status)->toBe(IncidentStatus::Resolved);
});

// ─── Audit actor recorded as admin (S13) ─────────────────────────────────────

it('records the admin as the audit actor, not the citizen', function (): void {
    $this->actingAs($this->adminOrg);

    $this->service->decide(
        $this->resolved->id,
        $this->adminOrg,
        ApprovalDecision::Approved,
        null,
    );

    $row = DB::table('status_history')
        ->where('incident_id', $this->resolved->id)
        ->where('new_status', IncidentStatus::Closed->value)
        ->first();

    expect($row)->not->toBeNull()
        ->and((int) $row->user_id)->toBe($this->adminOrg->id)
        ->and((int) $row->user_id)->not->toBe($this->citizen->id);
});

// ─── Concurrency: lockForUpdate guards against double decisions (S7) ──────────

it('returns 409 when two decisions race on the same incident (S7)', function (): void {
    $this->actingAs($this->adminOrg);

    // Seed a second source notification so the loser has its own row to
    // try to mark processed. (In production the same notification would
    // never be opened twice; the test simulates two callers arriving
    // concurrently with separate source rows pointing at the same
    // incident.)
    $otherSource = Notification::create([
        'user_id' => $this->systemAdmin->id,
        'incident_id' => $this->resolved->id,
        'type' => NotificationType::IncidenciaAtendidaParaAprobacion->value,
        'message' => 'Otro admin también la recibió.',
        'data' => [
            'incident_id' => $this->resolved->id,
            'actor_user_id' => $this->operatorOrg->id,
            'expires_at' => now()->addDays(7)->toIso8601String(),
            'organization_id' => $this->orgA->id,
        ],
        'read' => false,
    ]);

    // First decide succeeds — closes the incident.
    $this->service->decide(
        $this->resolved->id,
        $this->adminOrg,
        ApprovalDecision::Approved,
        null,
    );

    // Second decide — incident already closed, must throw 409.
    try {
        $this->service->decide(
            $this->resolved->id,
            $this->systemAdmin,
            ApprovalDecision::Rejected,
            'me arrepentí',
        );
        $this->fail('Expected RuntimeException for the second decision.');
    } catch (RuntimeException $e) {
        expect($e->getCode())->toBe(409);
    }

    // Incident is closed, untouched by the second decide attempt.
    expect($this->resolved->fresh()->status)->toBe(IncidentStatus::Closed);

    // Second source notification was NOT marked processed (tx rolled back).
    expect($otherSource->fresh()->processed_at)->toBeNull();
});

// ─── Notifications emitted to citizen (approve) / operator (reject) ─────────

it('notifies the citizen when approving', function (): void {
    $this->actingAs($this->adminOrg);

    $this->service->decide(
        $this->resolved->id,
        $this->adminOrg,
        ApprovalDecision::Approved,
        null,
    );

    $citizenNotif = Notification::query()
        ->where('user_id', $this->citizen->id)
        ->where('type', NotificationType::ResolucionAprobada->value)
        ->where('incident_id', $this->resolved->id)
        ->first();

    expect($citizenNotif)->not->toBeNull()
        ->and($citizenNotif->message)->toContain('cerrada');
});

it('notifies the operator when rejecting and includes the reason', function (): void {
    $this->actingAs($this->adminOrg);

    $reason = 'Faltan fotos del arreglo.';
    $this->service->decide(
        $this->resolved->id,
        $this->adminOrg,
        ApprovalDecision::Rejected,
        $reason,
    );

    $operatorNotif = Notification::query()
        ->where('user_id', $this->operatorOrg->id)
        ->where('type', NotificationType::ResolucionRechazada->value)
        ->where('incident_id', $this->resolved->id)
        ->first();

    expect($operatorNotif)->not->toBeNull()
        ->and($operatorNotif->message)->toContain($reason);
});

// ─── 404 when the incident does not exist ─────────────────────────────────────

it('throws 404 when the incident does not exist', function (): void {
    $this->actingAs($this->adminOrg);

    try {
        $this->service->decide(999_999, $this->adminOrg, ApprovalDecision::Approved, null);
        $this->fail('Expected RuntimeException for the missing incident.');
    } catch (RuntimeException $e) {
        expect($e->getCode())->toBe(404);
    }
});

// ─── 409 when the source notification has already been processed ─────────────

it('returns 409 when the source notification was already processed (S7)', function (): void {
    $this->actingAs($this->adminOrg);

    // Simulate a prior decision by marking the source notification processed.
    $this->sourceNotification->update(['processed_at' => now()->subMinute()]);

    try {
        $this->service->decide(
            $this->resolved->id,
            $this->adminOrg,
            ApprovalDecision::Approved,
            null,
        );
        $this->fail('Expected RuntimeException for the already-processed source.');
    } catch (RuntimeException $e) {
        expect($e->getCode())->toBe(409);
    }

    // Incident untouched.
    expect($this->resolved->fresh()->status)->toBe(IncidentStatus::Resolved);
});

// ─── 410 when the source notification has expired ─────────────────────────────

it('returns 410 when the source notification has expired (S6)', function (): void {
    $this->actingAs($this->adminOrg);

    $this->sourceNotification->update([
        'data' => array_merge($this->sourceNotification->data ?? [], [
            'expires_at' => now()->subDay()->toIso8601String(),
        ]),
    ]);

    try {
        $this->service->decide(
            $this->resolved->id,
            $this->adminOrg,
            ApprovalDecision::Approved,
            null,
        );
        $this->fail('Expected RuntimeException for the expired source.');
    } catch (RuntimeException $e) {
        expect($e->getCode())->toBe(410);
    }

    expect($this->resolved->fresh()->status)->toBe(IncidentStatus::Resolved);
});

// ─── Review fixes (blockers 1–4) ──────────────────────────────────────────────

it('records the rejection reason as a comment on the incident thread', function (): void {
    $this->actingAs($this->adminOrg);

    $reason = 'La foto no muestra el arreglo terminado.';
    $this->service->decide(
        $this->resolved->id,
        $this->adminOrg,
        ApprovalDecision::Rejected,
        $reason,
    );

    $comment = Comment::query()
        ->where('incident_id', $this->resolved->id)
        ->latest('id')
        ->first();

    expect($comment)->not->toBeNull()
        // The admin signs the comment — the thread must show who bounced it.
        ->and($comment->user_id)->toBe($this->adminOrg->id)
        ->and($comment->message)->toContain($reason);
});

it('does not comment on the thread when the decision is approve', function (): void {
    $this->actingAs($this->adminOrg);

    $this->service->decide(
        $this->resolved->id,
        $this->adminOrg,
        ApprovalDecision::Approved,
        null,
    );

    expect(Comment::query()->where('incident_id', $this->resolved->id)->count())->toBe(0);
});

it('notifies both the citizen and the operator on approve', function (): void {
    $this->actingAs($this->adminOrg);

    $this->service->decide(
        $this->resolved->id,
        $this->adminOrg,
        ApprovalDecision::Approved,
        null,
    );

    $citizenNotified = Notification::query()
        ->where('user_id', $this->citizen->id)
        ->where('incident_id', $this->resolved->id)
        ->where('type', NotificationType::ResolucionAprobada->value)
        ->exists();

    $operatorNotified = Notification::query()
        ->where('user_id', $this->operatorOrg->id)
        ->where('incident_id', $this->resolved->id)
        ->where('type', NotificationType::ResolucionAprobada->value)
        ->exists();

    expect($citizenNotified)->toBeTrue()
        ->and($operatorNotified)->toBeTrue();
});

it('reaches the citizen even when a status_change fired seconds earlier', function (): void {
    // Regression: NotificationService::notify() dedups on user+type+incident
    // within 60s and returns null silently. The observer already emits
    // StatusChange to the citizen when the incident turns `resolved`, so
    // reusing StatusChange here made the approval notice vanish whenever the
    // admin decided quickly — the happy path for an admin watching the bell.
    Notification::create([
        'user_id' => $this->citizen->id,
        'incident_id' => $this->resolved->id,
        'type' => NotificationType::StatusChange->value,
        'message' => 'Tu incidencia cambió de estado.',
        'data' => ['incident_id' => $this->resolved->id],
        'read' => false,
    ]);

    $this->actingAs($this->adminOrg);
    $this->service->decide(
        $this->resolved->id,
        $this->adminOrg,
        ApprovalDecision::Approved,
        null,
    );

    expect(Notification::query()
        ->where('user_id', $this->citizen->id)
        ->where('incident_id', $this->resolved->id)
        ->where('type', NotificationType::ResolucionAprobada->value)
        ->exists())->toBeTrue();
});

it('notifies the operator with the rejection type and reason', function (): void {
    $this->actingAs($this->adminOrg);

    $reason = 'Falta la evidencia fotográfica.';
    $this->service->decide(
        $this->resolved->id,
        $this->adminOrg,
        ApprovalDecision::Rejected,
        $reason,
    );

    $notification = Notification::query()
        ->where('user_id', $this->operatorOrg->id)
        ->where('incident_id', $this->resolved->id)
        ->where('type', NotificationType::ResolucionRechazada->value)
        ->first();

    expect($notification)->not->toBeNull()
        ->and($notification->data['rejection_reason'])->toBe($reason);
});

it('returns an unclaimed incident to pending instead of in_progress', function (): void {
    // An incident with no `claimed_by` sent to `in_progress` is orphaned:
    // no operator holds it and it never shows up in the `pending` claim
    // queue. It must go back to `pending` so someone can pick it up.
    $this->resolved->forceFill(['claimed_by' => null, 'claimed_at' => null])->save();

    $this->actingAs($this->adminOrg);
    $this->service->decide(
        $this->resolved->id,
        $this->adminOrg,
        ApprovalDecision::Rejected,
        'Sin operador asignado.',
    );

    expect($this->resolved->fresh()->status)->toBe(IncidentStatus::Pending);
});

it('keeps a claimed incident in in_progress on reject', function (): void {
    $this->actingAs($this->adminOrg);

    $this->service->decide(
        $this->resolved->id,
        $this->adminOrg,
        ApprovalDecision::Rejected,
        'Rehacer el trabajo.',
    );

    $incident = $this->resolved->fresh();
    expect($incident->status)->toBe(IncidentStatus::InProgress)
        ->and($incident->claimed_by)->toBe($this->operatorOrg->id);
});
