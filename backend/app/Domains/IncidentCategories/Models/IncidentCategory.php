<?php

declare(strict_types=1);

namespace App\Domains\IncidentCategories\Models;

use App\Domains\Organizations\Models\Organization;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class IncidentCategory extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name',
        'organization_id',
        'parent_id',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(IncidentCategory::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(IncidentCategory::class, 'parent_id');
    }
}
