<?php

use App\Domains\Auth\Http\AuthController;
use App\Domains\Auth\Http\Controllers\GoogleAuthController;
use App\Domains\Auth\Http\Controllers\RegisterController;
use App\Domains\Comments\Http\CommentController;
use App\Domains\IncidentCategories\Http\IncidentCategoryController;
use App\Domains\Incidents\Http\FeedController;
use App\Domains\Incidents\Http\IncidentController;
use App\Domains\Incidents\Http\IncidentStatsController;
use App\Domains\Incidents\Http\IncidentWorkflowController;
use App\Domains\Locations\Http\LocationController;
use App\Domains\Menus\Http\MenuController;
use App\Domains\Notifications\Http\NotificationController;
use App\Domains\Organizations\Http\OrganizationController;
use App\Domains\Roles\Http\RoleController;
use App\Domains\Users\Http\OperatorLocationController;
use App\Domains\Users\Http\UserController;
use App\StatusHistory\Interfaces\StatusHistoryController;
use Illuminate\Support\Facades\Route;

// Public
Route::post('/login', [AuthController::class, 'login']);
Route::post('/auth/refresh', [AuthController::class, 'refresh']);
// Self-service registration (PR-1 of registro-y-google-auth). Public —
// no auth middleware, only the per-IP throttle. Server hardcodes the
// `usuario` role; client-supplied role_id is ignored (R1, R5, R13a).
Route::post('/register', [RegisterController::class, 'register'])->middleware('throttle:register');
// Google ID-token login (PR-2 of registro-y-google-auth). Public —
// only the per-IP throttle. The Firebase verifier already gates
// forgery with a Google-signed JWT; throttle:google is
// defense-in-depth for brute-force / token-spray (R7-R10, R13b).
Route::post('/auth/google', [GoogleAuthController::class, 'login'])->middleware('throttle:google');
Route::get('/health', fn () => response()->json(['status' => 'ok']));
Route::get('/incidents/feed', FeedController::class)->middleware('throttle:feed');

Route::middleware('jwt')->group(function () {

    // Auth
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::put('/auth/profile', [AuthController::class, 'updateProfile']);

    // Operator tracking
    Route::post('/operator/location', [OperatorLocationController::class, 'update']);
    Route::get('/operator/locations', [OperatorLocationController::class, 'index']);

    // Core
    Route::get('incidents/stats', IncidentStatsController::class);
    // {incident} constrained to digits so the apiResource's show with an
    // alphabetic segment (e.g. "incidents/pendientes") doesn't try to bind
    // a non-numeric id and raise a 500 QueryException. Without this, an
    // endpoint that was never defined (because we deleted /pendientes)
    // returns a misleading "invalid input syntax for type bigint: pendientes".
    Route::post('incidents/{incident}/claim', [IncidentWorkflowController::class, 'claim'])->where('incident', '\d+')->middleware('can:claim,incident');
    Route::post('incidents/{incident}/release', [IncidentWorkflowController::class, 'release'])->where('incident', '\d+')->middleware('can:release,incident');
    Route::apiResource('incidents', IncidentController::class)->where(['incident' => '\d+']);
    Route::apiResource('incidents.comments', CommentController::class)->shallow();
    Route::get('incidents/{incident}/status-history', [StatusHistoryController::class, 'index'])->where('incident', '\d+');
    // Images are now handled via multipart in IncidentController::store/update
    // Legacy endpoint kept for now — remove after frontend migration

    // Notificaciones del usuario autenticado — real-time push vía Mercure
    // (ver AppServiceProvider::HubInterface + NotificationService::publish),
    // no un endpoint propio de streaming.
    Route::get('notifications', [NotificationController::class, 'index']);
    Route::patch('notifications/{notification}/read', [NotificationController::class, 'markRead']);
    Route::patch('notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::get('notifications/unread-count', [NotificationController::class, 'unreadCount']);

    // Catálogos
    Route::get('locations/tree', [LocationController::class, 'tree']);
    Route::apiResource('locations', LocationController::class);
    Route::get('organizations/tree', [OrganizationController::class, 'tree']);
    Route::apiResource('organizations', OrganizationController::class);
    Route::get('incident-categories/tree', [IncidentCategoryController::class, 'tree']);
    Route::apiResource('incident-categories', IncidentCategoryController::class);
    Route::apiResource('users', UserController::class);

    // RBAC
    Route::apiResource('roles', RoleController::class);
    Route::put('roles/{role}/permissions', [RoleController::class, 'syncPermissions']);
    Route::get('permissions', [RoleController::class, 'availablePermissions']);
    Route::get('permissions/my', [RoleController::class, 'myPermissions']);
    Route::get('menus/my', [MenuController::class, 'myMenus']);
});
