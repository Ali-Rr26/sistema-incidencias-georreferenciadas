<?php

declare(strict_types=1);

namespace App\Domains\Comments\Http\Policies;

use App\Domains\Shared\Http\Policies\PermissionPolicy;
use App\Domains\Users\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * Authorization for Comments.
 *
 * `viewAny`, `view`, and `create` come from {@see PermissionPolicy} and
 * delegate to the `comments.{view|create}` Gate dynamic.
 *
 * `update` and `delete` follow the **owner-or-permission** rule used in the
 * spec (R-17, R-18): the original author can always edit/delete their own
 * comment regardless of role changes — i.e. if you wrote it, you own it.
 * Otherwise, callers must hold `comments.update` / `comments.delete`.
 *
 * The parameter type is `Model` (not `Comment`) because PHP requires
 * overrides to match the parent's signature exactly — CommentPolicy extends
 * {@see PermissionPolicy}, whose `update`/`delete` declare `Model $model`.
 * We narrow inside the body via the `user_id` row, then fall through to
 * the permission gate.
 *
 * Discovered in the codebase audit #2323 (see proposal #2325 decision log);
 * the domain namespace is the convention adopted throughout the project
 * (AppServiceProvider::boot() Gate::guessPolicyNamesUsing).
 */
class CommentPolicy extends PermissionPolicy
{
    protected function resource(): string
    {
        return 'comments';
    }

    public function update(User $user, Model $comment): bool
    {
        // Owner always wins (R-17) — otherwise the comments.update gate.
        return (int) $comment->user_id === (int) $user->id
            || $user->can('comments.update');
    }

    public function delete(User $user, Model $comment): bool
    {
        return (int) $comment->user_id === (int) $user->id
            || $user->can('comments.delete');
    }
}
