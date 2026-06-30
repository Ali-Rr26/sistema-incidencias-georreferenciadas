<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Services;

use App\Domains\Incidents\Models\Incident;
use App\Domains\Incidents\Models\IncidentVerification;
use App\Domains\Users\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Servicio de verificación y confirmación de incidencias.
 *
 * El Publicador puede ver incidencias sin asignar que matcheen
 * la categoría y ubicación de su organización, y confirmarlas
 * para asignarlas a su org con SELECT FOR UPDATE.
 */
class IncidentVerificationService
{
    /**
     * Incidencias pendientes que puede confirmar el Publicador.
     *
     * Filtra por:
     * - organization_id IS NULL (sin asignar)
     * - category_id = org.incident_category_id
     * - location_id IN (descendants of org.location_id)
     *
     * @return Collection<int, Incident>
     */
    public function getPendingIncidents(User $publicador): Collection
    {
        $org = $publicador->organization;

        if ($org === null || $org->location_id === null || $org->incident_category_id === null) {
            return new Collection;
        }

        // Obtener IDs del subárbol de ubicación de la organización
        $locationIds = $org->location
            ? $org->location->descendantsAndSelf()->pluck('id')
            : collect();

        return Incident::query()
            ->whereNull('organization_id')
            ->where('incident_category_id', $org->incident_category_id)
            ->whereIn('location_id', $locationIds)
            ->with(['category', 'location', 'user'])
            ->get();
    }

    /**
     * Confirma y asigna una incidencia a la organización del Publicador.
     *
     * Usa SELECT FOR UPDATE dentro de una transacción para evitar
     * condiciones de carrera entre dos Publicadores.
     *
     * @throws \RuntimeException con código HTTP como semantic code
     */
    public function confirm(int $incidentId, User $publicador): Incident
    {
        return DB::transaction(function () use ($incidentId, $publicador): Incident {
            /** @var Incident|null $incident */
            $incident = Incident::query()
                ->where('id', $incidentId)
                ->lockForUpdate()
                ->first();

            if ($incident === null) {
                throw new \RuntimeException('Incidencia no encontrada.', 404);
            }

            if ($incident->organization_id !== null) {
                throw new \RuntimeException('Esta incidencia ya fue asignada a una organización.', 409);
            }

            $org = $publicador->organization;

            if ($org === null) {
                throw new \RuntimeException('No tenés una organización asignada.', 403);
            }

            // Check if category matches or is a descendant of the organization's category
            $matches = false;
            $currentCategoryId = $incident->incident_category_id;
            while ($currentCategoryId !== null) {
                if ($currentCategoryId === $org->incident_category_id) {
                    $matches = true;
                    break;
                }
                // Traverse up the parent chain
                $currentCategory = \App\Domains\IncidentCategories\Models\IncidentCategory::find($currentCategoryId);
                $currentCategoryId = $currentCategory?->parent_id;
            }

            if (! $matches) {
                throw new \RuntimeException(
                    'La categoría de esta incidencia no coincide con tu organización.',
                    403,
                );
            }

            $incident->update([
                'organization_id' => $org->id,
                'status' => 'pending_operator',
            ]);

            // Auditoría inmutable (REQ-VRF-03)
            IncidentVerification::create([
                'incident_id' => $incident->id,
                'verified_by' => $publicador->id,
                'verified_at' => now(),
                'organization_id' => $org->id,
            ]);

            return $incident->fresh();
        });
    }
}
