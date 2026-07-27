<?php

declare(strict_types=1);

namespace App\Domains\Incidents\Http\Policies;

use App\Domains\Incidents\Models\MeTooReport;
use App\Domains\Shared\Http\Policies\PermissionPolicy;
use App\Domains\Users\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * Authorization for "yo también reporto" (me-too) actions.
 *
 * create  — any authenticated user (the only gate is logged-in).
 * delete  — only the owner (R-17-style: you authored the report, you
 *           can remove it). Staff does NOT inherit delete authority.
 * viewAny — any authenticated user (the public GET endpoint exposes
 *           the count; the user-list endpoint is auth-required).
 * view    — same as viewAny.
 *
 * The IncidentResource / FeedSerializer surface viewer_has_me_too so
 * the frontend can render the toggle correctly without any per-user
 * authorization round-trip.
 */
class MeTooReportPolicy extends PermissionPolicy
{
    protected function resource(): string
    {
        return 'incidents';
    }

    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Model $model): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user !== null;
    }

    public function delete(User $user, Model $model): bool
    {
        return $user !== null && (int) $model->user_id === (int) $user->id;
    }
}
