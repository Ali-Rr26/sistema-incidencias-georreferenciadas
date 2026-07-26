<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Models;

use App\Domains\Users\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class ResolutionAudit extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'incident_id',
        'resolved_by_user_id',
        'resolved_at',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'resolved_at' => 'datetime',
            'incident_id' => 'integer',
            'resolved_by_user_id' => 'integer',
        ];
    }

    public function incident(): BelongsTo
    {
        return $this->belongsTo(Incident::class);
    }

    public function resolvedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by_user_id');
    }
}
