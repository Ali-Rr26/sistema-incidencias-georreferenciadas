<?php

declare(strict_types=1);

namespace App\Domains\Organizations\Models;

use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Incidents\Models\IncidentOrganizationAssignment;
use App\Domains\Locations\Models\Location;
use App\Domains\Users\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Organization extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name',
        'location_id',
        'parent_id',
    ];

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id');
    }

    public function incidentCategories(): BelongsToMany
    {
        return $this->belongsToMany(IncidentCategory::class, 'category_organization');
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function organizationAssignments(): HasMany
    {
        return $this->hasMany(IncidentOrganizationAssignment::class, 'organization_id');
    }

    public function claims(): HasMany
    {
        return $this->organizationAssignments();
    }
}
