<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Models;

use App\Domains\Organizations\Models\Organization;
use App\Domains\Users\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property-read int $id
 * @property-read int $incident_id
 * @property-read int $verified_by
 * @property-read Carbon $verified_at
 * @property-read int $organization_id
 */
class IncidentVerification extends Model
{
    /**
     * Registro inmutable de auditoría — no tiene timestamps.
     * Una vez creado, no debe modificarse ni eliminarse.
     */
    public $timestamps = false;

    protected $guarded = ['id'];

    public function incident(): BelongsTo
    {
        return $this->belongsTo(Incident::class);
    }

    public function verifiedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}
