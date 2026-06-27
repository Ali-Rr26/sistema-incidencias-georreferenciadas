<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Services;

use App\Domains\Incidents\Models\Incident;
use App\Domains\Incidents\Models\IncidentClaim;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Users\Models\User;
use Illuminate\Support\Facades\DB;

class ClaimService
{
    /**
     * Claim an incident on behalf of an organization.
     *
     * Inserts an accepted IncidentClaim row and atomically sets
     * incidents.organization_id to the claiming org's ID.
     * The partial unique index on pgsql (status='accepted') enforces
     * exclusivity at the database level without application-side locking.
     */
    public function claim(Incident $incident, Organization $org, User $actor): IncidentClaim
    {
        return DB::transaction(function () use ($incident, $org, $actor): IncidentClaim {
            $claim = IncidentClaim::create([
                'incident_id' => $incident->id,
                'organization_id' => $org->id,
                'claimed_by' => $actor->id,
                'status' => 'accepted',
                'claimed_at' => now(),
            ]);

            $incident->update(['organization_id' => $org->id]);

            return $claim;
        });
    }

    /**
     * Release a previously accepted claim.
     *
     * Marks the claim as released and atomically nulls
     * incidents.organization_id so the incident becomes unowned again.
     */
    public function release(IncidentClaim $claim): void
    {
        DB::transaction(function () use ($claim): void {
            $claim->update([
                'status' => 'released',
                'released_at' => now(),
            ]);

            $claim->incident()->update(['organization_id' => null]);
        });
    }
}
