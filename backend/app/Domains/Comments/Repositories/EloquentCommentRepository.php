<?php

declare(strict_types=1);

namespace App\Domains\Comments\Repositories;

use App\Domains\Comments\Models\Comment;
use App\Domains\Shared\Repositories\EloquentRepository;
use Illuminate\Database\Eloquent\Builder;

class EloquentCommentRepository extends EloquentRepository implements CommentRepository
{
    public function __construct()
    {
        parent::__construct(new Comment);
    }

    protected function applyFilters(Builder $query, array $filters): void
    {
        $query
            ->when($filters['incident_id'] ?? null, fn (Builder $q, $v) => $q->where('incident_id', $v));
    }
}
