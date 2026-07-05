<?php

use App\Domains\Assignments\Http\AssignmentController;
use App\Domains\Auth\Http\AuthController;
use App\Domains\Comments\Http\CommentController;
use App\Domains\IncidentCategories\Http\IncidentCategoryController;
use App\Domains\Incidents\Enums\IncidentStatus;
use App\Domains\Incidents\Http\FeedController;
use App\Domains\Incidents\Http\IncidentController;
use App\Domains\Incidents\Http\IncidentStatsController;
use App\Domains\Locations\Http\LocationController;
use App\Domains\Menus\Http\MenuController;
use App\Domains\Notifications\Http\NotificationController;
use App\Domains\Organizations\Http\OrganizationController;
use App\Domains\Permissions\Http\PermissionController;
use App\Domains\Roles\Http\RoleController;
use App\Domains\Users\Http\OperatorLocationController;
use App\Domains\Users\Http\UserController;
use App\StatusHistory\Interfaces\StatusHistoryController;
use Illuminate\Support\Facades\Route;

// Public
Route::post('/login', [AuthController::class, 'login']);
Route::post('/auth/refresh', [AuthController::class, 'refresh']);
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
    Route::get('incidents/pendientes', [IncidentController::class, 'pendientes']);
    Route::get('incidents/stats', IncidentStatsController::class);
    // CP-02-01-B: estados válidos del sistema
    Route::get('incidents/statuses', fn () => response()->json([
        'data' => collect(IncidentStatus::cases())->map(fn ($s) => [
            'value' => $s->value,
            'label' => $s->label(),
        ]),
    ]));
    // CP-02-02-B: cambio de estado dedicado
    Route::patch('incidents/{incident}/status', [IncidentController::class, 'updateStatus']);
    Route::post('incidents/{incident}/claim', [IncidentController::class, 'claim'])->middleware('can:claim,incident');
    Route::post('incidents/{incident}/release', [IncidentController::class, 'release'])->middleware('can:release,incident');
    Route::post('incidents/{incident}/confirmar', [IncidentController::class, 'confirmar'])->middleware('can:confirm,incident');
    Route::apiResource('incidents', IncidentController::class);
    Route::apiResource('incidents.comments', CommentController::class)->shallow();
    Route::apiResource('incidents.assignments', AssignmentController::class)->shallow();
    Route::get('incidents/{incident}/status-history', [StatusHistoryController::class, 'index']);
    // Images are now handled via multipart in IncidentController::store/update
    // Legacy endpoint kept for now — remove after frontend migration

    // Notificaciones del usuario autenticado
    Route::get('notifications', [NotificationController::class, 'index']);
    Route::patch('notifications/{notification}/read', [NotificationController::class, 'markRead']);

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
    Route::apiResource('permissions', PermissionController::class);
    Route::get('menus/my', [MenuController::class, 'myMenus']);
});
