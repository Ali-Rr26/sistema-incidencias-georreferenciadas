<?php

namespace App\Providers;

use App\Domains\Comments\Listeners\RedisCommentSync;
use App\Domains\Comments\Models\Comment;
use App\Domains\Comments\Repositories\CommentRepository;
use App\Domains\Comments\Repositories\EloquentCommentRepository;
use App\Domains\IncidentCategories\Repositories\EloquentIncidentCategoryRepository;
use App\Domains\IncidentCategories\Repositories\IncidentCategoryRepository;
use App\Domains\Incidents\Listeners\RedisIncidentSync;
use App\Domains\Incidents\Models\Incident;
use App\Domains\Incidents\Repositories\EloquentIncidentRepository;
use App\Domains\Incidents\Repositories\IncidentRepository;
use App\Domains\Locations\Repositories\EloquentLocationRepository;
use App\Domains\Locations\Repositories\LocationRepository;
use App\Domains\Organizations\Repositories\EloquentOrganizationRepository;
use App\Domains\Organizations\Repositories\OrganizationRepository;
use App\Domains\Permissions\Models\Permission;
use App\Domains\Roles\Repositories\EloquentRoleRepository;
use App\Domains\Roles\Repositories\RoleRepository;
use App\Domains\Sessions\Repositories\EloquentSessionRepository;
use App\Domains\Sessions\Repositories\SessionRepository;
use App\StatusHistory\Repositories\EloquentStatusHistoryRepository;
use App\StatusHistory\Repositories\StatusHistoryRepository;
use App\Domains\Users\Models\User;
use App\Domains\Users\Repositories\EloquentUserRepository;
use App\Domains\Users\Repositories\UserRepository;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(SessionRepository::class, EloquentSessionRepository::class);
        $this->app->bind(UserRepository::class, EloquentUserRepository::class);
        $this->app->bind(RoleRepository::class, EloquentRoleRepository::class);
        $this->app->bind(LocationRepository::class, EloquentLocationRepository::class);
        $this->app->bind(OrganizationRepository::class, EloquentOrganizationRepository::class);
        $this->app->bind(IncidentCategoryRepository::class, EloquentIncidentCategoryRepository::class);
        $this->app->bind(IncidentRepository::class, EloquentIncidentRepository::class);
        $this->app->bind(StatusHistoryRepository::class, EloquentStatusHistoryRepository::class);
        $this->app->bind(CommentRepository::class, EloquentCommentRepository::class);
    }

    public function boot(): void
    {
        // Admins bypass all gate/policy checks
        Gate::before(function (User $user, string $ability): ?bool {
            return $user->isAdmin() ? true : null;
        });

        // Dynamic gates from permissions table
        // Cada permiso en DB se convierte en un Gate: {resource}.{action}
        // Ej: resource="users" + action="create" → Gate::define('users.create', …)
        // $user->can('users.create') consulta la tabla role_permission
        try {
            foreach (Permission::all() as $permission) {
                $slug = "{$permission->resource}.{$permission->action}";
                Gate::define($slug, fn (User $user) => $user->hasPermission($slug));
            }
        } catch (\Throwable) {
            // Tabla aún no existe (primera migración), no hay permisos aún
        }

        // Register RedisIncidentSync as observer for Incident model events
        Incident::observe(RedisIncidentSync::class);

        // Register RedisCommentSync as observer for Comment model events
        Comment::observe(RedisCommentSync::class);

        // Policy discovery for modular Domains structure:
        // App\Domains\Incidents\Models\Incident
        // → App\Domains\Incidents\Http\Policies\IncidentPolicy
        //
        // Also handles legacy screaming architecture:
        // App\Incidents\Infrastructure\Models\Incident
        // → App\Incidents\Interfaces\Policies\IncidentPolicy
        Gate::guessPolicyNamesUsing(function (string $modelClass): ?string {
            if (preg_match('/^App\\\\Domains\\\\(\w+)\\\\Models\\\\(\w+)$/', $modelClass, $m)) {
                return "App\\Domains\\{$m[1]}\\Http\\Policies\\{$m[2]}Policy";
            }

            if (preg_match('/^App\\\\(\w+)\\\\Infrastructure\\\\Models\\\\(\w+)$/', $modelClass, $m)) {
                return "App\\{$m[1]}\\Interfaces\\Policies\\{$m[2]}Policy";
            }

            return null;
        });
    }
}
