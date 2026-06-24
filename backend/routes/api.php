<?php

use App\Assignments\Interfaces\AssignmentController;
use App\Domains\Auth\Http\AuthController;
use App\Comments\Interfaces\CommentController;
use App\IncidentCategories\Interfaces\IncidentCategoryController;
use App\Domains\Incidents\Http\IncidentController;
use App\Domains\Locations\Http\LocationController;
use App\Domains\Menus\Http\MenuController;
use App\Notifications\Interfaces\NotificationController;
use App\Organizations\Interfaces\OrganizationController;
use App\Domains\Permissions\Http\PermissionController;
use App\Domains\Roles\Http\RoleController;
use App\StatusHistory\Interfaces\StatusHistoryController;
use App\Domains\Users\Http\UserController;
use Illuminate\Support\Facades\Route;

// Public
Route::post('/login', [AuthController::class, 'login']);
Route::post('/auth/refresh', [AuthController::class, 'refresh']);
Route::get('/health', fn () => response()->json(['status' => 'ok']));

Route::middleware('jwt')->group(function () {

    // Auth
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    // Core
    Route::apiResource('incidents', IncidentController::class);
    Route::apiResource('incidents.comments', CommentController::class)->shallow();
    Route::apiResource('incidents.assignments', AssignmentController::class)->shallow();
    Route::get('incidents/{incident}/status-history', [StatusHistoryController::class, 'index']);

    // Notificaciones del usuario autenticado
    Route::get('notifications', [NotificationController::class, 'index']);
    Route::patch('notifications/{notification}/read', [NotificationController::class, 'markRead']);

    // Catálogos
    Route::get('locations/tree', [LocationController::class, 'tree']);
    Route::apiResource('locations', LocationController::class);
    Route::apiResource('organizations', OrganizationController::class);
    Route::apiResource('incident-categories', IncidentCategoryController::class);
    Route::apiResource('users', UserController::class);

    // RBAC
    Route::apiResource('roles', RoleController::class);
    Route::apiResource('permissions', PermissionController::class);
    Route::get('menus/my', [MenuController::class, 'myMenus']);
    Route::apiResource('menus', MenuController::class);
});
