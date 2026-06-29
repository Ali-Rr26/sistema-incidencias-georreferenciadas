<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Enums;

enum OrganizationAssignmentStatus: string
{
    case Accepted = 'accepted';
    case Released = 'released';
}
