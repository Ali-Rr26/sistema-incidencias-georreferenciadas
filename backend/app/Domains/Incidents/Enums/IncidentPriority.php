<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Enums;

enum IncidentPriority: string
{
    case Low = 'low';
    case Medium = 'medium';
    case High = 'high';
}
