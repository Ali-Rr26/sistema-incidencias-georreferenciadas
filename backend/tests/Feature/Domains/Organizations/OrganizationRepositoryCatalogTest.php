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
