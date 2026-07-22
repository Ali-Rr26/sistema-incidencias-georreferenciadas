<?php

declare(strict_types=1);

namespace App\Domains\Comments\Models;

use App\Domains\Comments\Observers\CommentObserver;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Users\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Comment extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'incident_id',
        'user_id',
        'message',
        'parent_id',
    ];

    protected function casts(): array
    {
        return [
            'incident_id' => 'integer',
            'user_id' => 'integer',
            'parent_id' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::observe(CommentObserver::class);
    }

    public function incident(): BelongsTo
    {
        return $this->belongsTo(Incident::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(Comment::class, 'parent_id');
    }

    public function replies(): HasMany
    {
        return $this->hasMany(Comment::class, 'parent_id');
    }

    public function images(): HasMany
    {
        return $this->hasMany(CommentImage::class);
    }

    public function getDepthAttribute(): int
    {
        if ($this->parent_id === null) {
            return 0;
        }

        if ($this->parent?->parent_id === null) {
            return 1;
        }

        return 2;
    }
}
