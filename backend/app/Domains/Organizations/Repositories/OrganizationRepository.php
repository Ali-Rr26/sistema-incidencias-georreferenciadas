<?php

declare(strict_types=1);

namespace App\Domains\Organizations\Repositories;

use App\Domains\Organizations\Models\Organization;
use App\Domains\Shared\Repositories\Repository;
use Illuminate\Support\Collection;

interface OrganizationRepository extends Repository
{
    public function tree(): Collection;

    /**
     * Organización que cubre una ubicación: su location_id coincide con la
     * ubicación dada o con alguno de sus ancestros en la jerarquía.
     * Usada por el auto-assign de organización al crear incidencias (B-02).
     */
    public function findForLocation(int $locationId): ?Organization;

    /**
     * Catálogo plano id/name (ordenado por nombre) para selects de
     * formularios. Con `$withParent` incluye parent_id (form de organizaciones).
     *
     * @return Collection<int, array{id: int, name: string, parent_id?: int|null}>
     */
    public function catalog(bool $withParent = false): Collection;
}
