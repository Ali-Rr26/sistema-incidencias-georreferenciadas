<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Services;

use App\Domains\Incidents\Enums\ApprovalDecision;
use App\Domains\Incidents\Enums\IncidentStatus;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Incidents\Models\IncidentApproval;
use App\Domains\Users\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Servicio de aprobación/rechazo de incidencias resueltas.
 *
 * @cqrs-role command-service
 *
 * Dueño único de las reglas de negocio de la decisión: la incidencia debe
 * estar `resolved`, no puede tener una decisión previa y el actor debe
 * pertenecer a la organización de la incidencia (salvo admin_sistema).
 *
 * Vive acá y no en la policy a propósito. La policy responde *quién* puede
 * decidir; el estado del recurso es dominio. Además `Gate::before` deja
 * pasar a admin_sistema por encima de cualquier policy, así que una regla
 * de estado ubicada ahí sería salteable por un superusuario — desde el
 * service no lo es.
 *
 * @see docs/Convenciones/architecture-cqrs-lite.md
 */
class IncidentApprovalService
{
    /**
     * Aprueba la resolución de una incidencia.
     *
     * @throws \RuntimeException con código HTTP como semantic code
     */
    public function approve(int $incidentId, User $admin): IncidentApproval
    {
        return $this->decide($incidentId, $admin, ApprovalDecision::Approved, null);
    }

    /**
     * Rechaza la resolución de una incidencia, con motivo opcional.
     *
     * @throws \RuntimeException con código HTTP como semantic code
     */
    public function reject(int $incidentId, User $admin, ?string $reason = null): IncidentApproval
    {
        return $this->decide($incidentId, $admin, ApprovalDecision::Rejected, $reason);
    }

    private function decide(
        int $incidentId,
        User $admin,
        ApprovalDecision $decision,
        ?string $reason,
    ): IncidentApproval {
        return DB::transaction(function () use ($incidentId, $admin, $decision, $reason): IncidentApproval {
            // lockForUpdate sobre la incidencia serializa dos decisiones
            // concurrentes sobre la misma fila; el unique index de
            // incident_approvals es el backstop a nivel DB.
            $incident = Incident::query()
                ->where('id', $incidentId)
                ->lockForUpdate()
                ->first();

            if ($incident === null) {
                throw new \RuntimeException('Incidencia no encontrada.', 404);
            }

            if ($incident->status !== IncidentStatus::Resolved) {
                throw new \RuntimeException('Solo se pueden decidir incidencias resueltas.', 409);
            }

            if (! $admin->isSystemAdmin() && $incident->organization_id !== $admin->organization_id) {
                throw new \RuntimeException('No pertenece a tu organización.', 403);
            }

            if (IncidentApproval::query()->where('incident_id', $incidentId)->exists()) {
                throw new \RuntimeException('Esta incidencia ya fue decidida.', 409);
            }

            return IncidentApproval::create([
                'incident_id' => $incidentId,
                'decided_by' => $admin->id,
                'decision' => $decision,
                'rejection_reason' => $reason,
                // La decisión pertenece a la organización de la incidencia,
                // no a la del actor: admin_sistema decide cross-org.
                'organization_id' => $incident->organization_id,
                'decided_at' => now(),
            ]);
        });
    }
}
