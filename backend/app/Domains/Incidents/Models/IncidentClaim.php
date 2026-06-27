<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Models;

use App\Domains\Incidents\Enums\ClaimStatus;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Users\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IncidentClaim extends Model
{
    protected $fillable = [
        'incident_id',
        'organization_id',
        'claimed_by',
        'status',
        'claimed_at',
        'released_at',
    ];

    protected function casts(): array
    {
        return [
            'claimed_at' => 'datetime',
            'released_at' => 'datetime',
            'status' => ClaimStatus::class,
        ];
    }

    public function incident(): BelongsTo
    {
        return $this->belongsTo(Incident::class);
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function claimedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'claimed_by');
    }
}
