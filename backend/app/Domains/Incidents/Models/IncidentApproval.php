<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Models;

use App\Domains\Incidents\Enums\ApprovalDecision;
use App\Domains\Organizations\Models\Organization;
use App\Domains\Users\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Decisión de un admin sobre una incidencia marcada como resuelta.
 *
 * @cqrs-role audit-record
 *
 * Registro inmutable y único por incidencia (unique index en
 * `incident_id`): una vez escrito no se actualiza ni se borra desde la
 * API. Sigue la forma de `incident_verifications`, incluyendo la ausencia
 * de `created_at`/`updated_at` — `decided_at` es la única marca temporal
 * relevante para auditoría.
 *
 * La escritura pasa siempre por IncidentApprovalService, que valida el
 * estado de la incidencia y la pertenencia organizacional.
 */
class IncidentApproval extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'incident_id',
        'decided_by',
        'decision',
        'rejection_reason',
        'organization_id',
        'decided_at',
    ];

    protected function casts(): array
    {
        return [
            'decision' => ApprovalDecision::class,
            'decided_at' => 'datetime',
            'incident_id' => 'integer',
            'decided_by' => 'integer',
            'organization_id' => 'integer',
        ];
    }

    public function incident(): BelongsTo
    {
        return $this->belongsTo(Incident::class);
    }

    public function decidedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}
