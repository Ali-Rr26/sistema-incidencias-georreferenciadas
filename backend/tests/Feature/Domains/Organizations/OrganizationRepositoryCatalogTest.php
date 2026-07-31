<?php

declare(strict_types=1);

use App\Domains\Locations\Models\Location;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Organizations\Repositories\EloquentOrganizationRepository;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->repo = new EloquentOrganizationRepository;
});

it('finds the organization covering a location through its ancestors', function (): void {
    $province = Location::create(['name' => 'Pichincha', 'level' => 'province']);
    $city = Location::create([
        'name' => 'Quito',
        'level' => 'city',
        'parent_id' => $province->id,
    ]);
    $org = Organization::create([
        'name' => 'GAD Pichincha',
        'location_id' => $province->id,
    ]);

    // Org sits at the province; an incident in the city must resolve to it.
    expect($this->repo->findForLocation($city->id)?->id)->toBe($org->id);
    // Direct match also works.
    expect($this->repo->findForLocation($province->id)?->id)->toBe($org->id);
});

it('returns null when no organization covers the location', function (): void {
    $loc = Location::create(['name' => 'Islote', 'level' => 'city']);

    expect($this->repo->findForLocation($loc->id))->toBeNull();
    expect($this->repo->findForLocation(999999))->toBeNull();
});

it('returns a name-ordered catalog with optional parent_id', function (): void {
    $loc = Location::create(['name' => 'HQ', 'level' => 'city']);
    $parent = Organization::create(['name' => 'Zeta Org', 'location_id' => $loc->id]);
    Organization::create([
        'name' => 'Alpha Org',
        'location_id' => $loc->id,
        'parent_id' => $parent->id,
    ]);

    $catalog = $this->repo->catalog();
    expect($catalog->pluck('name')->all())->toBe(['Alpha Org', 'Zeta Org']);
    expect($catalog->first())->not->toHaveKey('parent_id');

    $withParent = $this->repo->catalog(withParent: true);
    expect($withParent->firstWhere('name', 'Alpha Org')['parent_id'])->toBe($parent->id);
});

it('findNotifiedFor returns orgs whose location covers the incident location AND category matches or is NULL', function (): void {
    $category = \App\Domains\IncidentCategories\Models\IncidentCategory::create([
        'name' => 'Alumbrado Público',
        'parent_id' => null,
    ]);
    $otherCategory = \App\Domains\IncidentCategories\Models\IncidentCategory::create([
        'name' => 'Baches',
        'parent_id' => null,
    ]);

    $province = Location::create(['name' => 'Pichincha', 'level' => 'province']);
    $city = Location::create([
        'name' => 'Quito',
        'level' => 'city',
        'parent_id' => $province->id,
    ]);

    $transversal = Organization::create([
        'name' => 'GAD Provincial',
        'location_id' => $province->id,
        'incident_category_id' => null,
    ]);
    $categoriaMatch = Organization::create([
        'name' => 'Empresa Eléctrica Quito',
        'location_id' => $city->id,
        'incident_category_id' => $category->id,
    ]);
    $otraCategoria = Organization::create([
        'name' => 'Empresa de Baches',
        'location_id' => $city->id,
        'incident_category_id' => $otherCategory->id,
    ]);

    $notified = $this->repo->findNotifiedFor($city->id, $category->id);

    // Both the transversal (any category) and the category-specific match.
    // The other-category org must NOT be here.
    expect($notified->pluck('id')->sort()->values()->all())
        ->toBe([$transversal->id, $categoriaMatch->id]->sort()->values()->all());
    expect($notified->pluck('id'))->not->toContain($otraCategoria->id);
});

it('findNotifiedFor returns an empty collection when no location matches', function (): void {
    $category = \App\Domains\IncidentCategories\Models\IncidentCategory::create([
        'name' => 'Cualquiera',
        'parent_id' => null,
    ]);
    $loc = Location::create(['name' => 'Islote', 'level' => 'city']);

    expect($this->repo->findNotifiedFor($loc->id, $category->id))->toBeEmpty();
});

it('findNotifiedFor returns an empty collection when the location does not exist', function (): void {
    $category = \App\Domains\IncidentCategories\Models\IncidentCategory::create([
        'name' => 'Cualquiera',
        'parent_id' => null,
    ]);

    expect($this->repo->findNotifiedFor(999999, $category->id))->toBeEmpty();
});
