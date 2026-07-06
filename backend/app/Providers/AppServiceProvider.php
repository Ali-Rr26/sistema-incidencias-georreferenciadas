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
use App\Domains\Users\Models\User;
use App\Domains\Users\Repositories\EloquentUserRepository;
use App\Domains\Users\Repositories\UserRepository;
use App\Storage\StorageService;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Redis;
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
        $this->app->bind(CommentRepository::class, EloquentCommentRepository::class);
    }

    public function boot(): void
    {
        // Rate limiting para el feed público (REQ-RTL-01/02/03)
        RateLimiter::for('feed', function (Request $request): Limit {
            $user = $request->user();

            // SuperAdmin exento
            if ($user !== null && method_exists($user, 'isSystemAdmin') && $user->isSystemAdmin()) {
                return Limit::none();
            }

            // Usuarios autenticados: 120/min por defecto
            if ($user !== null) {
                return Limit::perMinute((int) env('FEED_RATE_LIMIT_PER_MIN', 120));
            }

            // No autenticados: 60/min por defecto (REQ-RTL-01)
            return Limit::perMinute((int) env('FEED_RATE_LIMIT_PER_MIN', 60));
        });

// Admins bypass all gate/policy checks
            Gate::before(function (User $user, string $ability): ?bool {
                return $user->isAdmin() ? true : null;
            });

            // Register policy for Notification (no apiResource, so guesser
            // does not cover it automatically).
            try {
                Gate::policy(
                    \App\Domains\Notifications\Models\Notification::class,
                    \App\Domains\Notifications\Http\Policies\NotificationPolicy::class,
                );
            } catch (\Throwable) {
                // Models not loaded yet (e.g. during package discovery).
            }

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

            // Register IncidentNotificationObserver to dispatch user notifications
            // when an incident is claimed, released, or resolved.
            try {
                Incident::observe(\App\Domains\Notifications\Observers\IncidentNotificationObserver::class);
            } catch (\Throwable) {
                // Notifications tables not ready yet — skip silently.
            }

            // Register RedisCommentSync as observer for Comment model events
            Comment::observe(RedisCommentSync::class);

        // =====================================================================
        // Connection health checks — logged on every boot
        // =====================================================================

        $this->healthCheckPostgres();
        $this->healthCheckRedis();
        $this->healthCheckStorage();

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

    // ──────────────────────────────────────────────────────────────────────────
    // Connection health checks
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Verifies PostgreSQL connection and logs the database name.
     */
    private function healthCheckPostgres(): void
    {
        try {
            $pdo = DB::connection()->getPdo();
            $dbName = $pdo->query('SELECT current_database()')->fetchColumn();
            $dbVersion = $pdo->query('SELECT version()')->fetchColumn();

            Log::info('[HEALTH] PostgreSQL connected', [
                'database' => $dbName,
                'version' => preg_replace('/\s+.*/', '', $dbVersion),
            ]);
        } catch (\Throwable $e) {
            Log::warning('[HEALTH] PostgreSQL connection FAILED', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Verifies Redis connection and logs server info.
     */
    private function healthCheckRedis(): void
    {
        try {
            Redis::connection()->ping();
            $info = Redis::connection()->info('server');
            $redisVersion = $info['server']['redis_version'] ?? 'unknown';

            Log::info('[HEALTH] Redis connected', [
                'version' => $redisVersion,
            ]);
        } catch (\Throwable $e) {
            Log::warning('[HEALTH] Redis connection FAILED', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Verifies S3-compatible storage (RustFS / MinIO / AWS S3).
     */
    private function healthCheckStorage(): void
    {
        $disk = env('FILESYSTEM_STORAGE_DISK', 's3');

        if ($disk !== 's3') {
            Log::info('[HEALTH] Storage disk is local', ['disk' => $disk]);

            return;
        }

        try {
            $service = app(StorageService::class);
            $ok = $service->ensureBucketExists();

            if ($ok) {
                $bucket = StorageService::bucketName();
                Log::info('[HEALTH] S3 storage connected', [
                    'bucket' => $bucket,
                    'endpoint' => env('AWS_ENDPOINT'),
                ]);
            } else {
                Log::warning('[HEALTH] S3 storage — bucket not available', [
                    'bucket' => StorageService::bucketName(),
                ]);
            }
        } catch (\Throwable $e) {
            Log::warning('[HEALTH] S3 storage FAILED', [
                'error' => $e->getMessage(),
            ]);
        }
    }
}
