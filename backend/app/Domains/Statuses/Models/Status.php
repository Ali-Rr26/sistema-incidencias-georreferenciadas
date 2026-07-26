<?php

declare(strict_types=1);

namespace App\Domains\Statuses\Models;

use Illuminate\Database\Eloquent\Model;

class Status extends Model
{
    protected $fillable = [
        'nombre',
        'valor',
        'activo',
    ];

    protected $casts = [
        'activo' => 'boolean',
    ];

    /**
     * Scope to only active statuses.
     */
    public function scopeActive($query)
    {
        return $query->where('activo', true);
    }
}
