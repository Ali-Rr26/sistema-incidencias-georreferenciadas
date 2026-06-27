<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Services;

use App\Domains\Incidents\Models\Incident;
use App\Domains\Incidents\Models\IncidentOrganizationAssignment;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Users\Models\User;
use Illuminate\Support\Facades\DB;

class IncidentOrganizationAssignmentService
{
    /**
     * Assign an incident to an organization.
     *
     * Inserts an accepted IncidentOrganizationAssignment row and atomically sets
     * incidents.organization_id to the assigned org's ID.
     */
    public function assign(Incident $incident, Organization $org, User $actor): IncidentOrganizationAssignment
    {
        return DB::transaction(function () use ($incident, $org, $actor): IncidentOrganizationAssignment {
            $assignment = IncidentOrganizationAssignment::create([
                'incident_id' => $incident->id,
                'organization_id' => $org->id,
                'claimed_by' => $actor->id,
                'status' => 'accepted',
                'claimed_at' => now(),
            ]);

            $incident->update(['organization_id' => $org->id]);

            return $assignment;
        });
    }

    /**
     * Release a previously accepted assignment.
     */
    public function release(IncidentOrganizationAssignment $assignment): void
    {
        DB::transaction(function () use ($assignment): void {
            $assignment->update([
                'status' => 'released',
                'released_at' => now(),
            ]);

            $assignment->incident()->update(['organization_id' => null]);
        });
    }
}
