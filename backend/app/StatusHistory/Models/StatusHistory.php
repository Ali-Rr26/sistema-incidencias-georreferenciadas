<?php

declare(strict_types=1);

namespace App\StatusHistory\Models;

use App\Domains\Incidents\Enums\IncidentStatus;
use App\Domains\Users\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StatusHistory extends Model
{
    public $timestamps = false;

    protected $table = 'status_history';

    protected $fillable = [
        'incident_id',
        'user_id',
        'previous_status',
        'new_status',
        'comment',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
            'previous_status' => IncidentStatus::class,
            'new_status' => IncidentStatus::class,
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
