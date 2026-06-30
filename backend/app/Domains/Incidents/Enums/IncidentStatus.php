<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Enums;

enum IncidentStatus: string
{
    case Pending = 'pending';
    case PendingOperator = 'pending_operator';
    case InProgress = 'in_progress';
    case Resolved = 'resolved';
}
