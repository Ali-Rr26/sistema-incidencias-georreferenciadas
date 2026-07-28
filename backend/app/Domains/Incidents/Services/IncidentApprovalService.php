<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Services;

use App\Domains\Comments\Models\Comment;
use App\Domains\Incidents\Enums\ApprovalDecision;
use App\Domains\Incidents\Enums\IncidentStatus;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Incidents\Repositories\IncidentRepository;
use App\Domains\Notifications\Enums\NotificationType;
use App\Domains\Notifications\Models\Notification;
use App\Domains\Notifications\Services\NotificationService;
use App\Domains\Users\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Service de aprobación/rechazo de incidencias resueltas.
 *
 * WU2 (PR-1b) rewrite — `decide()` es el único entrypoint público. El
 * contrato es por completo *side-effect-based*: la decisión no se persiste
 * como agregado, sino que se infiere de la transición de estado del
 * `Incident` (`closed` para aprobar, `in_progress` para rechazar) y del
 * `processed_at` de la notificación origen. Este es el cambio que cierra el
 * flujo end-to-end (ver proposal §"Descartar el refactor" y design §1
 * ADR-1).
 *
 * ─── Contrato de mutación de status (CRÍTICO) ──────────────────────────────
 *
 * Toda mutación de status debe ir por `EloquentIncidentRepository::update()`
 * (o `EloquentIncidentRepository::claim()`/`release()`). Esto es no-negociable:
 * el repositorio envuelve su mutación en `DB::transaction` + `bindAuditActor()`
 * que setea `app.current_user_id = Auth::id()` antes del UPDATE. El trigger
 * de Postgres `trg_log_incident_status` lee esa variable y, si está vacía,
 * cae al fallback `COALESCE(NEW.user_id, OLD.user_id)` — el ciudadano. Eso
 * haría que `status_history.user_id` quedara como el ciudadano en lugar del
 * admin decisor (escenario S13 de la propuesta), exactamente el bug que el
 * refactor histórico quería evitar.
 *
 * Por este motivo:
 *
 *   ❌ NO usar `Incident::query()->whereKey($id)->update($payload)` directo
 *      — bypassa el actor binding.
 *   ❌ NO usar `$incident->update($payload)` (modelo cargado manualmente)
 *      — el binding sólo aplica si la mutación pasa por el repositorio.
 *   ✅ USAR `$this->repository->update($incidentId, $payload)` siempre.
 *
 * Ver design §1 ADR-2 para la justificación arquitectónica completa.
 *
 * ─── Quién vs Qué ─────────────────────────────────────────────────────────
 *
 * El service es dueño único de las invariantes de estado: la policy
 * responde *quién* (admin_sistema / admin_organizacion con org match); el
 * service responde *qué* (status resuelto, sin decisión previa, no
 * expirado). La separación es deliberada: `Gate::before` en
 * `AppServiceProvider::boot()` deja pasar a `admin_sistema` por encima de
 * cualquier policy, así que una invariante de estado ubicada en la policy
 * sería salteable por un superusuario. Desde el service no lo es.
 *
 * ─── Atomicidad ───────────────────────────────────────────────────────────
 *
 * Toda la operación está envuelta en una única `DB::transaction`. Si la
 * notificación de destino falla, el rollback deja la incidencia intacta y la
 * notificación origen con `processed_at IS NULL` — la UI puede reintentar.
 * Si el mark-as-processed del origen falla, el rollback también cubre la
 * transición de estado (no queda un estado inconsistente a medio aplicar).
 *
 * Códigos de error (semantic HTTP codes via RuntimeException code):
 *  - 404: la incidencia no existe.
 *  - 409: la incidencia no está en `resolved`, ya hay una decisión previa
 *    sobre la notificación origen, o la notificación ya está marcada como
 *    procesada (race condition o doble submit).
 *  - 410: la notificación origen está expirada (`expires_at` ya pasó).
 *  - 422: rechazo sin `reason` (el service es bypass-proof: la policy no
 *    alcanza a un admin_sistema via Gate::before).
 */
class IncidentApprovalService
{
    public function __construct(
        private readonly IncidentRepository $repository,
        private readonly NotificationService $notifications,
    ) {}

    /**
     * Decide la aprobación de una incidencia resuelta.
     *
     * Wraps every side-effect in a single `DB::transaction`. On rollback the
     * source notification stays untouched (`processed_at IS NULL`) so the UI
     * can retry the action safely.
     *
     * @throws \RuntimeException with the HTTP semantic code (see class docblock)
     */
    public function decide(
        int $incidentId,
        User $admin,
        ApprovalDecision $decision,
        ?string $reason,
    ): Notification {
        // `reject` siempre requiere motivo. Esta validación vive en el
        // service (no en la policy) porque `Gate::before` deja pasar a
        // admin_sistema por encima de cualquier policy — un chequeo solo en
        // la policy sería salteable por un superusuario.
        if ($decision === ApprovalDecision::Rejected && ($reason === null || trim($reason) === '')) {
            throw new \RuntimeException('El motivo de rechazo es obligatorio.', 422);
        }

        return DB::transaction(function () use ($incidentId, $admin, $decision, $reason): Notification {
            // `lockForUpdate` sobre la fila del incidente serializa dos
            // decisiones concurrentes; el commit libera el lock.
            /** @var Incident|null $incident */
            $incident = Incident::query()
                ->where('id', $incidentId)
                ->lockForUpdate()
                ->first();

            if ($incident === null) {
                throw new \RuntimeException("Incidencia [{$incidentId}] no encontrada.", 404);
            }

            if ($incident->status !== IncidentStatus::Resolved) {
                throw new \RuntimeException(
                    'Solo se pueden decidir incidencias en estado resolved.',
                    409,
                );
            }

            // Resolución + actor binding van por el repositorio para que el
            // trigger de `status_history` registre al admin como actor
            // (design §1 ADR-2). El repositorio envuelve su propio
            // `DB::transaction` + `bindAuditActor()` que setea
            // `app.current_user_id = Auth::id()` antes del UPDATE.
            // Captured before the update: `payloadFor()` clears `claimed_by`
            // on approve, so the post-update model can no longer tell us who
            // was holding the incident.
            $operatorId = $incident->claimed_by;

            $payload = $this->payloadFor($incident, $decision);
            $incident = $this->repository->update($incidentId, $payload);

            // Rejection reason goes on the incident thread, where the
            // operator actually looks — not only inside the notification
            // payload (issue #150, comment 1). Same transaction: if the
            // comment fails, the status transition rolls back with it.
            if ($decision === ApprovalDecision::Rejected) {
                $this->recordRejectionComment($incident, $admin, (string) $reason);
            }

            // Source notification: marcar como procesada.
            $source = Notification::query()
                ->where('incident_id', $incidentId)
                ->where('user_id', $admin->id)
                ->where('type', NotificationType::IncidenciaAtendidaParaAprobacion->value)
                ->whereNull('processed_at')
                ->lockForUpdate()
                ->first();

            if ($source === null) {
                throw new \RuntimeException(
                    'messages.notification_already_decided',
                    409,
                );
            }

            $this->assertNotExpired($source);

            // Emitir la notificación de destino ANTES de marcar el origen
            // como procesado: si la notificación falla, la transacción
            // hace rollback y el origen queda `processed_at IS NULL` — la
            // UI puede reintentar (design §2 notas clave).
            $this->emitDestinationNotification($incident, $decision, $reason, $operatorId);

            // Marca el origen. `forceFill` evita que un futuro cambio en
            // `$fillable` haga fallar silenciosamente el guardado.
            $source->forceFill([
                'processed_at' => now(),
                'data' => array_merge($source->data ?? [], [
                    'decision' => $decision->value,
                    'rejection_reason' => $decision === ApprovalDecision::Rejected ? $reason : null,
                    'decided_at' => now()->toIso8601String(),
                    'decided_by' => $admin->id,
                ]),
            ])->save();

            return $source->fresh();
        });
    }

    /**
     * Build the payload for `EloquentIncidentRepository::update()` based on
     * the decision. Approve clears the claim (terminal state); reject
     * preserves it (the operator remains responsible for the rework).
     */
    private function payloadFor(Incident $incident, ApprovalDecision $decision): array
    {
        if ($decision === ApprovalDecision::Approved) {
            return [
                'status' => IncidentStatus::Closed->value,
                // `claimed_by = null` keeps the "currently claimed" query
                // (`claimed_by IS NOT NULL`) honest without filtering by
                // status. Same for `released_from` if/when it gets added
                // (design §1 ADR-3).
                'claimed_by' => null,
                'claimed_at' => null,
            ];
        }

        // Reject with an operator still holding the claim: back to
        // `in_progress`, claim preserved — they own the rework.
        if ($incident->claimed_by !== null) {
            return [
                'status' => IncidentStatus::InProgress->value,
            ];
        }

        // Reject with no operator on record: `in_progress` would orphan the
        // incident — nobody holds it and it never surfaces in the `pending`
        // claim queue. Send it back to `pending` so it can be picked up.
        return [
            'status' => IncidentStatus::Pending->value,
        ];
    }

    /**
     * Write the rejection reason as a comment on the incident thread.
     *
     * Signed by the deciding admin so the thread shows who bounced it back.
     * Runs inside the caller's transaction — a failure here rolls back the
     * status transition too, so the incident never ends up in `in_progress`
     * with no explanation attached.
     */
    private function recordRejectionComment(Incident $incident, User $admin, string $reason): void
    {
        Comment::create([
            'incident_id' => $incident->id,
            'user_id' => $admin->id,
            'message' => "Resolución rechazada: {$reason}",
        ]);
    }

    /**
     * Notify everyone involved in the decision. Failures bubble up and roll
     * back the transaction.
     *
     * Approve reaches BOTH the citizen and the operator who resolved it
     * (issue #150, comment 1: "Notifica al operador y a los ciudadanos
     * involucrados"). Reject reaches the operator, who owns the rework.
     *
     * `$operatorId` is captured before the update because `payloadFor()`
     * clears `claimed_by` on approve.
     */
    private function emitDestinationNotification(
        Incident $incident,
        ApprovalDecision $decision,
        ?string $reason,
        ?int $operatorId,
    ): void {
        // Resolved via `User::query()->find()` rather than
        // `$incident->user()->find()`: the `BelongsTo` relation already has
        // `where('id', '=', $incident->user_id)` baked in, and `->find()`
        // ANDs onto it — which would silently return null for any
        // `$operatorId` that differs from `user_id`.
        $operator = $operatorId !== null ? User::query()->find($operatorId) : null;
        $citizen = $incident->user;

        if ($decision === ApprovalDecision::Approved) {
            if ($citizen === null) {
                // Defensive: every incident has a user_id, but if the row
                // is somehow orphaned we still want a clear failure rather
                // than silently skipping the side-effect.
                throw new \RuntimeException(
                    "Incidencia [{$incident->id}] sin ciudadano asociado.",
                    500,
                );
            }

            $payload = [
                'incident_id' => $incident->id,
                'decision' => 'approved',
                'new_status' => IncidentStatus::Closed->value,
            ];

            $this->notifications->notify(
                $citizen,
                NotificationType::ResolucionAprobada,
                "Tu incidencia \"{$incident->title}\" fue cerrada por el admin.",
                $incident->id,
                $payload,
            );

            // The operator who resolved it also gets told. Skipped when the
            // operator IS the citizen — one notice is enough.
            if ($operator !== null && $operator->id !== $citizen->id) {
                $this->notifications->notify(
                    $operator,
                    NotificationType::ResolucionAprobada,
                    "Tu resolución de \"{$incident->title}\" fue aprobada.",
                    $incident->id,
                    $payload,
                );
            }

            return;
        }

        if ($operator === null) {
            // No operator on record — fall back to notifying the citizen so
            // they at least know the incident bounced back.
            $operator = $citizen;
        }

        if ($operator === null) {
            throw new \RuntimeException(
                "Incidencia [{$incident->id}] sin destinatario para la notificación de rechazo.",
                500,
            );
        }

        $reasonText = $reason ?? '(sin motivo)';
        $this->notifications->notify(
            $operator,
            NotificationType::ResolucionRechazada,
            "Tu incidencia \"{$incident->title}\" fue devuelta por el admin. Motivo: {$reasonText}",
            $incident->id,
            [
                'incident_id' => $incident->id,
                'decision' => 'rejected',
                'rejection_reason' => $reason,
                'new_status' => $incident->status->value,
            ],
        );
    }

    /**
     * Aborta con 410 si `data->expires_at` ya pasó. Trata fechas inválidas
     * como expiradas (fail-closed).
     *
     * @throws \RuntimeException 410 si la notificación está expirada
     */
    private function assertNotExpired(Notification $source): void
    {
        $expiresAt = $source->data['expires_at'] ?? null;
        if ($expiresAt === null) {
            return;
        }

        try {
            $expiresAtDt = new \DateTimeImmutable((string) $expiresAt);
        } catch (\Throwable) {
            throw new \RuntimeException(
                'messages.notification_expired',
                410,
            );
        }

        if ($expiresAtDt <= new \DateTimeImmutable) {
            throw new \RuntimeException(
                'messages.notification_expired',
                410,
            );
        }
    }
}
