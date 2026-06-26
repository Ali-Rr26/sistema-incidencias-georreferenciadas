<?php

declare(strict_types=1);

namespace App\StatusHistory\Models;

use App\Domains\Incidents\Models\Incident;
use App\Domains\Users\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StatusHistory extends Model
{
    const UPDATED_AT = null;

    protected $table = 'status_history';

    protected $fillable = [
        'incident_id',
        'user_id',
        'previous_status',
        'new_status',
        'comentario',
    ];

    public function incident(): BelongsTo
    {
        return $this->belongsTo(Incident::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
