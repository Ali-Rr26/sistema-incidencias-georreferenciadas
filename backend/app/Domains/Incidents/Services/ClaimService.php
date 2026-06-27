<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Services;

use App\Domains\Incidents\Models\Incident;
use App\Domains\Incidents\Models\IncidentOrganizationAssignment;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Users\Models\User;

class ClaimService
{
    private IncidentOrganizationAssignmentService $service;

    public function __construct()
    {
        $this->service = new IncidentOrganizationAssignmentService;
    }

    public function claim(Incident $incident, Organization $org, User $actor): IncidentOrganizationAssignment
    {
        return $this->service->assign($incident, $org, $actor);
    }

    public function release(IncidentOrganizationAssignment $claim): void
    {
        $this->service->release($claim);
    }
}
