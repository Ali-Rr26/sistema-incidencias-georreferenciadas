<?php

declare(strict_types=1);

namespace App\Domains\Organizations\Http\Policies;

use App\Domains\Shared\Http\Policies\PermissionPolicy;

class OrganizationPolicy extends PermissionPolicy
{
    protected function resource(): string
    {
        return 'organizations';
    }
}
