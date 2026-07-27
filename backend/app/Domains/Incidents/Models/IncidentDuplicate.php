<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Models;

use App\Domains\Users\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IncidentDuplicate extends Model
{
    protected $fillable = [
        'original_incident_id',
        'duplicate_incident_id',
        'reported_by_user_id',
        'reason',
        'status',
        'reviewed_by_user_id',
        'reviewed_at',
    ];

    protected function casts(): array
    {
        return [
            'original_incident_id' => 'integer',
            'duplicate_incident_id' => 'integer',
            'reported_by_user_id' => 'integer',
            'reviewed_by_user_id' => 'integer',
            'reviewed_at' => 'datetime',
        ];
    }

    public function original(): BelongsTo
    {
        return $this->belongsTo(Incident::class, 'original_incident_id');
    }

    public function duplicate(): BelongsTo
    {
        return $this->belongsTo(Incident::class, 'duplicate_incident_id');
    }

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reported_by_user_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by_user_id');
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    public function isConfirmed(): bool
    {
        return $this->status === 'confirmed';
    }

    public function isRejected(): bool
    {
        return $this->status === 'rejected';
    }
}
