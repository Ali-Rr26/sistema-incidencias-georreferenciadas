<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Models;

use App\Domains\IncidentCategories\Models\IncidentCategory;
use App\Domains\Incidents\Enums\IncidentPriority;
use App\Domains\Incidents\Enums\IncidentStatus;
use App\Domains\Incidents\Enums\OrganizationAssignmentStatus;
use App\Domains\Locations\Models\Location;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Users\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use MatanYadaev\EloquentSpatial\Objects\Point;
use MatanYadaev\EloquentSpatial\Traits\HasSpatial;

class Incident extends Model
{
    use HasSpatial, SoftDeletes;

    public const STATUS_PENDING = 'pending';

    public const STATUS_IN_PROGRESS = 'in_progress';

    public const STATUS_RESOLVED = 'resolved';

    public const PRIORITY_LOW = 'low';

    public const PRIORITY_MEDIUM = 'medium';

    public const PRIORITY_HIGH = 'high';

    protected $fillable = [
        'incident_category_id',
        'organization_id',
        'user_id',
        'location_id',
        'title',
        'description',
        'status',
        'priority',
        'resolution_date',
        'geom',
    ];

    protected $attributes = [
        'status' => IncidentStatus::Pending->value,
    ];

    protected function casts(): array
    {
        return [
            'geom' => Point::class,
            'resolution_date' => 'datetime',
            'status' => IncidentStatus::class,
            'priority' => IncidentPriority::class,
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(IncidentCategory::class, 'incident_category_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function organizationAssignments(): HasMany
    {
        return $this->hasMany(IncidentOrganizationAssignment::class);
    }

    public function activeOrganizationAssignment(): HasOne
    {
        return $this->hasOne(IncidentOrganizationAssignment::class)->where('status', OrganizationAssignmentStatus::Accepted->value);
    }

    public function claims(): HasMany
    {
        return $this->organizationAssignments();
    }

    public function acceptedClaim(): HasOne
    {
        return $this->activeOrganizationAssignment();
    }
}
