<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Enums;

enum ClaimStatus: string
{
    case Accepted = 'accepted';
    case Released = 'released';
}
