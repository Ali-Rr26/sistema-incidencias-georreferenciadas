<?php

declare(strict_types=1);

use App\Domains\Menus\Models\Menu;
use App\Domains\Users\Models\User;
use Database\Seeders\MenuSeeder;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(PermissionSeeder::class);
    $this->seed(RoleSeeder::class);
    $this->seed(RolePermissionSeeder::class);
    $this->seed(MenuSeeder::class);
});

/**
 * @return array<int, array{name: string, route: string}>
 */
function flattenMenuRoutes(array $nodes): array
{
    $out = [];
    foreach ($nodes as $node) {
        if (! empty($node['route'])) {
            $out[] = ['name' => $node['name'], 'route' => $node['route']];
        }
        if (! empty($node['children'])) {
            $out = array_merge($out, flattenMenuRoutes($node['children']));
        }
    }

    return $out;
}

/**
 * @param  array<int, array<string, mixed>>  $nodes
 * @return array<int, string>
 */
function collectRoutes(array $nodes): array
{
    return array_map(fn (array $n): string => $n['route'], flattenMenuRoutes($nodes));
}

it('admin_sistema sees every active menu via the isAdmin() bypass branch', function (): void {
    $user = User::factory()->create(['role_id' => 1]);

    $response = $this->withoutMiddleware()->actingAs($user)->getJson('/api/menus/my');

    $response->assertOk();
    $data = $response->json('data');
    $routes = collectRoutes($data);

    expect($routes)->toContain('/dashboard')
        ->and($routes)->toContain('/incidencias')
        ->and($routes)->toContain('/incidencias/crear')
        ->and($routes)->toContain('/usuarios')
        ->and($routes)->toContain('/roles')
        ->and($routes)->toContain('/localizaciones')
        ->and($routes)->toContain('/categorias')
        ->and($routes)->toContain('/organizaciones')
        ->and($routes)->toContain('/notificaciones')
        // admin_sistema sees citizen entries too via bypass
        ->and($routes)->toContain('/feed')
        ->and($routes)->toContain('/feed/crear')
        ->and($routes)->toContain('/configuracion/perfil');
});

it('operador_sistema sees Nueva Incidencia but NOT Usuarios or Roles', function (): void {
    $user = User::factory()->create(['role_id' => 2]);

    $response = $this->withoutMiddleware()->actingAs($user)->getJson('/api/menus/my');

    $response->assertOk();
    $routes = collectRoutes($response->json('data'));

    expect($routes)->toContain('/dashboard')
        ->and($routes)->toContain('/incidencias')
        ->and($routes)->toContain('/incidencias/crear')
        ->and($routes)->toContain('/localizaciones')
        ->and($routes)->toContain('/categorias')
        ->and($routes)->toContain('/notificaciones')
        // Back-office Gestión group is gated by users.* and roles.* — operador_sistema lacks those.
        ->and($routes)->not->toContain('/usuarios')
        ->and($routes)->not->toContain('/roles');
});

it('operador_organizacion now sees Notificaciones after the leak fix', function (): void {
    $user = User::factory()->create(['role_id' => 4]);

    $response = $this->withoutMiddleware()->actingAs($user)->getJson('/api/menus/my');

    $response->assertOk();
    $routes = collectRoutes($response->json('data'));

    expect($routes)->toContain('/incidencias')
        // Previously missing: the menu was hidden despite notifications.update.
        ->and($routes)->toContain('/notificaciones')
        // Does NOT see Nueva Incidencia (incidents.manage).
        ->and($routes)->not->toContain('/incidencias/crear')
        // Does NOT see citizen feed (no feed.view for this role).
        ->and($routes)->not->toContain('/feed');
});

it('admin_organizacion sees back-office plus citizen entries (spec override)', function (): void {
    $user = User::factory()->create(['role_id' => 3]);

    $response = $this->withoutMiddleware()->actingAs($user)->getJson('/api/menus/my');

    $response->assertOk();
    $routes = collectRoutes($response->json('data'));

    // Back-office items
    expect($routes)->toContain('/dashboard')
        ->and($routes)->toContain('/incidencias')
        ->and($routes)->toContain('/incidencias/crear')
        ->and($routes)->toContain('/usuarios')
        ->and($routes)->toContain('/roles')
        ->and($routes)->toContain('/organizaciones')
        ->and($routes)->toContain('/notificaciones');

    // Citizen items (per design Decision 1: feed.view granted to admin_organizacion)
    expect($routes)->toContain('/feed')
        ->and($routes)->toContain('/feed/crear')
        ->and($routes)->toContain('/configuracion/perfil');
});

it('usuario sees only the four citizen entries — no back-office, no /incidencias', function (): void {
    $user = User::factory()->create(['role_id' => 5]);

    $response = $this->withoutMiddleware()->actingAs($user)->getJson('/api/menus/my');

    $response->assertOk();
    $data = $response->json('data');
    $routes = collectRoutes($data);

    expect($routes)->toContain('/feed')
        ->and($routes)->toContain('/feed/crear')
        ->and($routes)->toContain('/configuracion/perfil')
        ->and($routes)->toContain('/mapa');

    // No back-office at all
    expect($routes)->not->toContain('/dashboard')
        ->and($routes)->not->toContain('/incidencias')
        ->and($routes)->not->toContain('/incidencias/crear')
        ->and($routes)->not->toContain('/incidencias/pendientes')
        ->and($routes)->not->toContain('/usuarios')
        ->and($routes)->not->toContain('/roles')
        ->and($routes)->not->toContain('/localizaciones')
        ->and($routes)->not->toContain('/categorias')
        ->and($routes)->not->toContain('/organizaciones')
        ->and($routes)->not->toContain('/notificaciones');

    // The 4 entries are exactly the citizen ones, with no parent header
    expect(count($data))->toBe(4);
    $names = array_map(fn (array $n): string => $n['name'], $data);
    expect($names)->toEqualCanonicalizing(['Inicio', 'Reportar', 'Perfil', 'Mapa']);
});

it('creates the three new citizen menu rows (16, 17, 18) with the expected gates', function (): void {
    $inicio = Menu::where('menu_id', 16)->first();
    $reportar = Menu::where('menu_id', 17)->first();
    $perfil = Menu::where('menu_id', 18)->first();

    expect($inicio)->not->toBeNull()
        ->and($inicio->name)->toBe('Inicio')
        ->and($inicio->route)->toBe('/feed')
        ->and($inicio->icon)->toBe('house')
        ->and($inicio->parent_id)->toBeNull();

    expect($reportar)->not->toBeNull()
        ->and($reportar->name)->toBe('Reportar')
        ->and($reportar->route)->toBe('/feed/crear')
        ->and($reportar->icon)->toBe('circle-plus')
        ->and($reportar->parent_id)->toBeNull();

    expect($perfil)->not->toBeNull()
        ->and($perfil->name)->toBe('Perfil')
        ->and($perfil->route)->toBe('/configuracion/perfil')
        ->and($perfil->icon)->toBe('user')
        ->and($perfil->parent_id)->toBeNull();
});

it('menu id 4 (Nueva Incidencia) is gated by incidents.manage, not incidents.create', function (): void {
    $nueva = Menu::where('menu_id', 4)->first();
    expect($nueva)->not->toBeNull()
        ->and($nueva->name)->toBe('Nueva Incidencia');

    // The permission attached to id 4 must be incidents.manage now.
    $perm = $nueva->permissions()->first();
    expect($perm)->not->toBeNull()
        ->and($perm->resource)->toBe('incidents')
        ->and($perm->action)->toBe('manage');
});

it('citizen (usuario) never sees admin back-office create route — regression for leak 43e66378', function (): void {
    // Regression pinning for the security fix in commit 43e66378.
    // Before that commit, the `usuario` role (citizen) saw the admin
    // /incidencias/crear route in their menu despite having only `feed.view`
    // (not `incidents.manage`). The fix split the menu entry into two rows
    // with distinct permission gates:
    //   - menu_id 17 (Reportar)         → feed.view
    //   - menu_id  4 (Nueva Incidencia) → incidents.manage
    //
    // This focused tripwire exists alongside the broader per-role assertions
    // (lines 157 and 212) so that any future "cleanup" of the apparent
    // duplication is caught by CI with an explicit, named failure before it
    // ships. If this test breaks, re-read commit 43e66378 before touching
    // MenuSeeder.
    $user = User::factory()->create(['role_id' => 5]); // usuario = citizen

    $response = $this->withoutMiddleware()->actingAs($user)->getJson('/api/menus/my');

    $response->assertOk();
    $routes = collectRoutes($response->json('data'));

    // The back-office create route must never appear in a citizen's menu,
    // regardless of any other permissions they hold.
    expect($routes)->not->toContain('/incidencias/crear');
});

it('menu id 1 (Dashboard) stores icon = gauge-high', function (): void {
    $dashboard = Menu::where('menu_id', 1)->first();
    expect($dashboard)->not->toBeNull()
        ->and($dashboard->name)->toBe('Dashboard')
        ->and($dashboard->icon)->toBe('gauge-high');
});

it('menu id 1 (Dashboard) icon survives MenuSeeder re-run (idempotency)', function (): void {
    // Re-run the seeder
    $this->seed(MenuSeeder::class);

    $dashboard = Menu::where('menu_id', 1)->first();
    expect($dashboard)->not->toBeNull()
        ->and($dashboard->icon)->toBe('gauge-high');
});

it('menu id 7 (Gestión parent header) stores icon = shield-halved (FA6 Free compliance)', function (): void {
    // R-Cleanup: shield-check is FontAwesome Pro only — it does not exist
    // in @fortawesome/fontawesome-free@6.5.2 (the CDN loaded by frontend/index.html)
    // and renders as a broken/missing glyph in the sidebar. shield-halved is
    // the FA6 Free equivalent and is the canonical replacement.
    $gestion = Menu::where('menu_id', 7)->first();
    expect($gestion)->not->toBeNull()
        ->and($gestion->name)->toBe('Gestión')
        ->and($gestion->icon)->toBe('shield-halved');
});

it('MenuSeeder is idempotent — re-running produces no duplicate citizen rows', function (): void {
    $firstCount = Menu::whereIn('menu_id', [16, 17, 18])->count();
    expect($firstCount)->toBe(3);

    $this->seed(MenuSeeder::class);

    $secondCount = Menu::whereIn('menu_id', [16, 17, 18])->count();
    expect($secondCount)->toBe(3);
});
