<?php

declare(strict_types=1);

namespace App\Domains\Organizations\Repositories;

use App\Domains\Shared\Repositories\Repository;
use Illuminate\Support\Collection;

interface OrganizationRepository extends Repository
{
    public function tree(): Collection;
}
