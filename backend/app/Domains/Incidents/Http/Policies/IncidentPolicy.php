<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Http\Policies;

use App\Domains\Shared\Http\Policies\PermissionPolicy;

class IncidentPolicy extends PermissionPolicy
{
    protected function resource(): string
    {
        return 'incidents';
    }
}
