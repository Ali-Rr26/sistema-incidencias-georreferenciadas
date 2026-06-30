<?php

use App\Assignments\Interfaces\AssignmentController;
use App\Domains\Auth\Http\AuthController;
use App\Domains\Comments\Http\CommentController;
use App\Domains\IncidentCategories\Http\IncidentCategoryController;
use App\Domains\Incidents\Http\FeedController;
use App\Domains\Incidents\Http\IncidentController;
use App\Domains\Locations\Http\LocationController;
use App\Domains\Menus\Http\MenuController;
use App\Domains\Organizations\Http\OrganizationController;
use App\Domains\Permissions\Http\PermissionController;
use App\Domains\Roles\Http\RoleController;
use App\Domains\Users\Http\UserController;
use App\Notifications\Interfaces\NotificationController;
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

    // Core
    Route::get('incidents/pendientes', [IncidentController::class, 'pendientes']);
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
