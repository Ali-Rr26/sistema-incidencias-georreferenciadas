<?php

declare(strict_types=1);

use App\Domains\Permissions\Models\Permission;
use App\Domains\Users\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(PermissionSeeder::class);
    $this->seed(RoleSeeder::class);
    $this->seed(RolePermissionSeeder::class);

    foreach (Permission::all() as $permission) {
        $slug = "{$permission->resource}.{$permission->action}";
        Gate::define($slug, fn (User $user) => $user->hasPermission($slug));
    }
});

it('admin_sistema bypasses all gates', function (): void {
    $user = User::factory()->create([
        'role_id' => 1, // admin_sistema
    ]);

    expect(Gate::forUser($user)->allows('incidents.view'))->toBeTrue();
    expect(Gate::forUser($user)->allows('users.create'))->toBeTrue();
    expect(Gate::forUser($user)->allows('random.permission'))->toBeTrue();
});

it('admin_organizacion has correct permission configuration', function (): void {
    $user = User::factory()->create([
        'role_id' => 3, // admin_organizacion
    ]);

    // Has users management
    expect(Gate::forUser($user)->allows('users.view'))->toBeTrue();
    expect(Gate::forUser($user)->allows('users.create'))->toBeTrue();
    expect(Gate::forUser($user)->allows('users.update'))->toBeTrue();
    expect(Gate::forUser($user)->allows('users.delete'))->toBeTrue();

    // Has organization edit (update)
    expect(Gate::forUser($user)->allows('organizations.view'))->toBeTrue();
    expect(Gate::forUser($user)->allows('organizations.update'))->toBeTrue();
    expect(Gate::forUser($user)->allows('organizations.create'))->toBeFalse();
    expect(Gate::forUser($user)->allows('organizations.delete'))->toBeFalse();

    // Has incidents list/edit (view/update)
    expect(Gate::forUser($user)->allows('incidents.view'))->toBeTrue();
    expect(Gate::forUser($user)->allows('incidents.update'))->toBeTrue();
});

it('operador_organizacion has incident view, notification update, and comment creation/update permissions', function (): void {
    $user = User::factory()->create([
        'role_id' => 4, // operador_organizacion
    ]);

    // Has incident view
    expect(Gate::forUser($user)->allows('incidents.view'))->toBeTrue();

    // Has notification update
    expect(Gate::forUser($user)->allows('notifications.update'))->toBeTrue();

    // Has comment creation and update
    expect(Gate::forUser($user)->allows('comments.create'))->toBeTrue();
    expect(Gate::forUser($user)->allows('comments.update'))->toBeTrue();

    // Does NOT have users management or incident create/delete
    expect(Gate::forUser($user)->allows('users.create'))->toBeFalse();
    expect(Gate::forUser($user)->allows('incidents.create'))->toBeFalse();
    expect(Gate::forUser($user)->allows('incidents.delete'))->toBeFalse();
});

it('usuario has incident creation and comment creation permissions', function (): void {
    $user = User::factory()->create([
        'role_id' => 5, // usuario
    ]);

    expect(Gate::forUser($user)->allows('incidents.create'))->toBeTrue();
    expect(Gate::forUser($user)->allows('comments.create'))->toBeTrue();

    // Does NOT have other permissions
    expect(Gate::forUser($user)->allows('incidents.update'))->toBeFalse();
    expect(Gate::forUser($user)->allows('users.create'))->toBeFalse();
});

it('publicador has incident view and status history view permissions', function (): void {
    $user = User::factory()->create([
        'role_id' => 6, // publicador
    ]);

    // Has incidents view (needed to see pendientes)
    expect(Gate::forUser($user)->allows('incidents.view'))->toBeTrue();

    // Has status history view
    expect(Gate::forUser($user)->allows('status-history.view'))->toBeTrue();

    // Does NOT have users create, comments edit, or assignments management
    // (the assignment/confirmation flow is gated by IncidentPolicy::confirm
    //  on UserRole::Publicador, not by catalog permissions)
    expect(Gate::forUser($user)->allows('users.create'))->toBeFalse();
    expect(Gate::forUser($user)->allows('comments.update'))->toBeFalse();
    expect(Gate::forUser($user)->allows('assignments.create'))->toBeFalse();
});
