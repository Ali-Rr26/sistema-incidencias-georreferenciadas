<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Models;

use App\Domains\Users\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MeTooReport extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'incident_id',
        'user_id',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'incident_id' => 'integer',
            'user_id' => 'integer',
            'created_at' => 'datetime',
        ];
    }

    public function incident(): BelongsTo
    {
        return $this->belongsTo(Incident::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
